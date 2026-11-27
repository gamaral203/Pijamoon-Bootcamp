import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import * as cdk from 'aws-cdk-lib/core';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { apagarLogsNoDestroy } from './regras';

const RAIZ = path.join(__dirname, '..', '..');

/** A branch do Amplify que vira a URL pública da loja. */
const BRANCH = 'main';

/** Pasta do bucket de onde o Amplify publica o site. */
const PREFIXO = 'site';

/**
 * Disjuntor: se o site entregar mais do que isto num minuto, ele sai do ar.
 * 100 MB por minuto são ~80 downloads completos do site (1,2 MB) por minuto,
 * coisa que gente navegando não alcança. Um minuto assim custa ~US$ 0,015.
 */
export const LIMITE_DISJUNTOR_BYTES_POR_MINUTO = 100 * 1024 * 1024;

/** Arquivos de site/ que não vão para o ar: código-fonte e configuração. */
const FORA_DO_SITE = ['ts', 'node_modules', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json', '*.map'];

export interface SiteStackProps extends cdk.StackProps {
  /** A API do back-end (PijamoonStack), para encaminhar /api/*. */
  readonly api: apigwv2.IHttpApi;
  /** Opcional: também avisa este e-mail quando o disjuntor desarmar. */
  readonly emailAlertas?: string;
}

/**
 * A hospedagem do site com o Amplify Hosting.
 *
 * A conta do desafio bloqueia o CloudFront, então quem entrega o site é o
 * Amplify: ele tem a própria CDN e o próprio HTTPS, gerenciados pela AWS.
 *
 *   site/ → bucket privado → Amplify publica → https://main.<id>.amplifyapp.com
 *                                               └─ /api/* → API Gateway
 *
 * E, como o Amplify não tem limite de requisições sem pagar um firewall
 * (WAF, US$ 15 por mês), a stack inclui um disjuntor que tira o site do ar
 * se o tráfego disparar.
 */
export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    /* ------------------------------------------------------------------
     * Amplify: o app, a branch e a regra de /api/*
     * ------------------------------------------------------------------ */

    // O endereço da API, para onde o Amplify encaminha /api/*.
    const urlApi = `https://${props.api.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

    // O Amplify não tem construct L2 estável no CDK: CfnApp e CfnBranch são
    // os recursos AWS::Amplify::* do CloudFormation direto (L1).
    // Sem repositório Git: o app é de "deploy manual", e quem manda os
    // arquivos é o próprio CDK (ver a publicação mais abaixo).
    const app = new amplify.CfnApp(this, 'AppSite', {
      name: 'pijamoon',
      description: 'Pijamoon: site da loja',
      platform: 'WEB',
      customRules: [
        // Status 200 com um endereço de fora é um proxy reverso: o navegador
        // continua vendo /api/products no domínio da loja, então o front não
        // muda e não precisa de CORS (o mesmo papel do /api/* no CloudFront).
        { source: '/api/<*>', target: `${urlApi}/api/<*>`, status: '200' },
      ],
      // Imagens mudam pouco: o navegador guarda por um dia, e quem volta à
      // loja não baixa tudo de novo (menos bytes entregues, menos custo).
      customHeaders: [
        'customHeaders:',
        "  - pattern: '/img/**'",
        '    headers:',
        "      - key: 'Cache-Control'",
        "        value: 'public, max-age=86400'",
      ].join('\n'),
    });

    const branch = new amplify.CfnBranch(this, 'BranchSite', {
      appId: app.attrAppId,
      branchName: BRANCH,
      stage: 'PRODUCTION',
      enableAutoBuild: false, // não há build no Amplify: o site chega pronto
    });

    /* ------------------------------------------------------------------
     * Publicação: site/ → bucket privado → Amplify
     * ------------------------------------------------------------------ */

    // Bucket privado: é só a "caixa de entrega" de onde o Amplify copia o
    // site. O público nunca acessa o bucket; quem serve as páginas é o Amplify.
    const bucketSite = new s3.Bucket(this, 'BucketSite', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Projeto de estudo: no `cdk destroy`, esvazia e apaga o bucket.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // O Amplify lê o bucket com a identidade do próprio serviço. A permissão
    // vale só para esta conta e esta branch (a documentação pede o ARN da
    // branch codificado como URL; a forma normal também entra, por garantia).
    const arnBranch = `arn:${this.partition}:amplify:${this.region}:${this.account}:apps/${app.attrAppId}/branches/${BRANCH}`;
    const condicaoAmplify = {
      StringEquals: {
        'aws:SourceAccount': this.account,
        'aws:SourceArn': [
          arnBranch,
          `arn%3A${this.partition}%3Aamplify%3A${this.region}%3A${this.account}%3Aapps%2F${app.attrAppId}%2Fbranches%2F${BRANCH}`,
        ],
      },
    };
    bucketSite.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('amplify.amazonaws.com')],
        actions: ['s3:ListBucket'],
        resources: [bucketSite.bucketArn],
        conditions: condicaoAmplify,
      }),
    );
    bucketSite.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('amplify.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [bucketSite.arnForObjects(`${PREFIXO}/*`)],
        conditions: condicaoAmplify,
      }),
    );

    // Copia os arquivos de site/ para o bucket.
    // O site precisa estar compilado (site/js/ é gerado pelo tsc e não vai pro Git).
    const pastaSite = path.join(RAIZ, 'site');
    if (!fs.existsSync(path.join(pastaSite, 'js', 'shared.js'))) {
      throw new Error('site/js/ não existe: rode "npm run build" dentro de site/ antes do deploy.');
    }
    const copiaSite = new s3deploy.BucketDeployment(this, 'CopiaSite', {
      sources: [s3deploy.Source.asset(pastaSite, { exclude: FORA_DO_SITE })],
      destinationBucket: bucketSite,
      destinationKeyPrefix: PREFIXO,
      memoryLimit: 512,
    });

    // Manda o Amplify publicar o que está no bucket (StartDeployment).
    // O id muda quando algum arquivo do site muda: aí o CloudFormation roda a
    // chamada de novo e a versão nova vai ao ar. Sem mudança, nada acontece.
    const publicar: cr.AwsSdkCall = {
      service: 'Amplify',
      action: 'StartDeployment',
      parameters: {
        appId: app.attrAppId,
        branchName: BRANCH,
        sourceUrl: `s3://${bucketSite.bucketName}/${PREFIXO}/`,
        sourceUrlType: 'BUCKET_PREFIX',
      },
      physicalResourceId: cr.PhysicalResourceId.of(`site-${hashDaPasta(pastaSite)}`),
    };
    const publicacao = new cr.AwsCustomResource(this, 'PublicacaoSite', {
      onCreate: publicar,
      onUpdate: publicar,
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({ actions: ['amplify:StartDeployment'], resources: [`${arnBranch}/*`, arnBranch] }),
        new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:ListBucket'], resources: [bucketSite.bucketArn, bucketSite.arnForObjects('*')] }),
      ]),
      installLatestAwsSdk: false,
    });
    // Só publica depois que os arquivos chegaram no bucket e a branch existe.
    publicacao.node.addDependency(copiaSite, branch);

    /* ------------------------------------------------------------------
     * Disjuntor: alarme de tráfego → SNS → Lambda que tira o site do ar
     * ------------------------------------------------------------------ */

    // Quantos bytes o Amplify entregou por minuto (o Amplify publica esta
    // métrica no CloudWatch a cada minuto, sem custo).
    const bytesEntregues = new cloudwatch.Metric({
      namespace: 'AWS/AmplifyHosting',
      metricName: 'BytesDownloaded',
      dimensionsMap: { App: app.attrAppId },
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.minutes(1),
    });
    const alarmeTrafego = new cloudwatch.Alarm(this, 'AlarmeTrafegoSite', {
      alarmDescription: 'O site entregou tráfego demais em 1 minuto: o disjuntor tira o site do ar.',
      metric: bytesEntregues,
      threshold: LIMITE_DISJUNTOR_BYTES_POR_MINUTO,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      // Sem visitas, não há dado: isso é normal, não é alarme.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // O alarme publica num tópico, e o tópico avisa quem estiver inscrito:
    // a Lambda do disjuntor e, se informado, o e-mail. Um aviso, vários
    // consumidores, sem o alarme conhecer nenhum deles.
    const topicoDisjuntor = new sns.Topic(this, 'TopicoDisjuntor', {
      displayName: 'Pijamoon: disjuntor do site',
    });
    alarmeTrafego.addAlarmAction(new cwActions.SnsAction(topicoDisjuntor));

    const funcaoDisjuntor = new lambda.Function(this, 'FuncaoDisjuntor', {
      description: 'Tira o site do ar (senha no Amplify) quando o tráfego dispara',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(RAIZ, 'backend', 'disjuntor')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: { APP_ID: app.attrAppId, BRANCH_NAME: BRANCH },
      logGroup: new logs.LogGroup(this, 'LogsDisjuntor', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    // Menor privilégio: só pode mudar esta branch, e mais nada no Amplify.
    funcaoDisjuntor.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['amplify:UpdateBranch'], resources: [arnBranch] }),
    );
    topicoDisjuntor.addSubscription(new subs.LambdaSubscription(funcaoDisjuntor));
    if (props.emailAlertas) {
      topicoDisjuntor.addSubscription(new subs.EmailSubscription(props.emailAlertas));
    }

    apagarLogsNoDestroy(this);

    /* ------------------------------------------------------------------
     * Saídas
     * ------------------------------------------------------------------ */
    new cdk.CfnOutput(this, 'UrlLoja', { value: `https://${BRANCH}.${app.attrDefaultDomain}` });
    new cdk.CfnOutput(this, 'IdAppAmplify', { value: app.attrAppId });
  }
}

/**
 * Um resumo (hash) de todos os arquivos do site que vão para o ar: muda
 * quando qualquer um deles muda, e só nesse caso.
 */
function hashDaPasta(pasta: string): string {
  const hash = createHash('sha256');
  const foraDoSite = (nome: string) =>
    FORA_DO_SITE.some((regra) => (regra.startsWith('*.') ? nome.endsWith(regra.slice(1)) : nome === regra));
  const visitar = (dir: string) => {
    for (const nome of fs.readdirSync(dir).sort()) {
      if (foraDoSite(nome)) continue;
      const caminho = path.join(dir, nome);
      if (fs.statSync(caminho).isDirectory()) {
        visitar(caminho);
      } else {
        hash.update(path.relative(pasta, caminho).replace(/\\/g, '/'));
        hash.update(fs.readFileSync(caminho));
      }
    }
  };
  visitar(pasta);
  return hash.digest('hex').slice(0, 12);
}
