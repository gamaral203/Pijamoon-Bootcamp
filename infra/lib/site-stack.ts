import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { funcaoNode } from './funcao';
import { apagarLogsNoDestroy } from './regras';

const RAIZ = path.join(__dirname, '..', '..');

/** Pasta do bucket onde fica o site (o CloudFront lê a partir dela). */
const PREFIXO = 'site';

/**
 * Disjuntor: se o site entregar mais do que isto num minuto, ele sai do ar.
 * 100 MB por minuto são ~80 downloads completos do site (1,2 MB) por minuto,
 * coisa que gente navegando não alcança.
 */
export const LIMITE_DISJUNTOR_BYTES_POR_MINUTO = 100 * 1024 * 1024;

/** Arquivos de site/ que não vão para o ar: código-fonte e configuração. */
const FORA_DO_SITE = ['ts', 'node_modules', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json', '*.map'];

export interface SiteStackProps extends cdk.StackProps {
  /** A API do back-end (PijamoonStack), para encaminhar /api/*. */
  readonly api: apigwv2.IHttpApi;
  /** O id do app client do Cognito, que vai para o js/config.js do site. */
  readonly idClienteCognito: string;
  /** Opcional: também avisa este e-mail quando o disjuntor desarmar. */
  readonly emailAlertas?: string;
}

/**
 * A hospedagem do site com CloudFront + S3 privado.
 *
 *   navegador ──▶ CloudFront ─┬─ /api/*  → API Gateway (sem cache)
 *                             └─ o resto → S3 privado (via OAC, com cache)
 *
 * O CloudFront tem uma franquia gratuita permanente de 1 TB por mês de
 * tráfego: no uso da loja, a entrega do site fica de graça. Ainda assim, a
 * stack mantém o disjuntor, que desliga a distribuição se o tráfego disparar.
 */
export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    /* ------------------------------------------------------------------
     * Bucket privado + CloudFront
     * ------------------------------------------------------------------ */

    // Ninguém acessa o bucket direto: só o CloudFront, via Origin Access Control.
    const bucketSite = new s3.Bucket(this, 'BucketSite', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // projeto de estudo
      autoDeleteObjects: true,
    });

    // O endereço da API sem o "https://", que é o que o CloudFront espera.
    const dominioApi = `${props.api.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

    // Completa endereços de pasta (/pedidos/ → /pedidos/index.html) na borda.
    const indiceDePasta = new cloudfront.Function(this, 'FuncaoIndiceDePasta', {
      comment: 'Completa /pasta/ para /pasta/index.html (o S3 privado não faz isso)',
      code: cloudfront.FunctionCode.fromFile({ filePath: path.join(__dirname, '..', 'funcoes', 'indice-de-pasta.js') }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const distribuicao = new cloudfront.Distribution(this, 'DistribuicaoSite', {
      comment: 'Pijamoon: site e API',
      defaultRootObject: 'index.html',
      // Todas as regiões da borda (padrão), inclusive São Paulo: os clientes
      // estão no Brasil. A franquia gratuita de 1 TB vale para qualquer classe;
      // a classe só muda o preço do que passar dela.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucketSite, { originPath: `/${PREFIXO}` }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{ function: indiceDePasta, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        // /api/*: vai para o API Gateway, sem cache na borda (o catálogo tem
        // o próprio cache, e pedidos/carrinho precisam vir sempre atualizados).
        '/api/*': {
          origin: new origins.HttpOrigin(dominioApi, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Repassa query string, headers (inclusive o Authorization do login)
          // e corpo, menos o Host: o API Gateway precisa receber o próprio domínio.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // checkout (POST) e carrinho (PUT)
        },
      },
    });

    /* ------------------------------------------------------------------
     * Publicação: site/ + js/config.js → bucket → limpa o cache
     * ------------------------------------------------------------------ */

    // O site precisa estar compilado (site/js/ é gerado pelo tsc e não vai pro Git).
    const pastaSite = path.join(RAIZ, 'site');
    if (!fs.existsSync(path.join(pastaSite, 'js', 'shared.js'))) {
      throw new Error('site/js/ não existe: rode "npm run build" dentro de site/ antes do deploy.');
    }

    // js/config.js: as configurações que mudam a cada conta e a cada deploy
    // (região e app client do Cognito), geradas na publicação. Nada aqui é
    // segredo: o app client de um site é público por natureza.
    const conteudoConfig = `window.PIJAMOON_CONFIG = ${JSON.stringify({ regiao: this.region, idClienteCognito: props.idClienteCognito })};\n`;

    new s3deploy.BucketDeployment(this, 'CopiaSite', {
      sources: [
        s3deploy.Source.asset(pastaSite, { exclude: FORA_DO_SITE }),
        s3deploy.Source.data('js/config.js', conteudoConfig),
      ],
      destinationBucket: bucketSite,
      destinationKeyPrefix: PREFIXO,
      // Depois de copiar, limpa o cache do CloudFront: a versão nova aparece na hora.
      distribution: distribuicao,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    /* ------------------------------------------------------------------
     * Disjuntor: alarme de tráfego → SNS → Lambda que desliga a distribuição
     * ------------------------------------------------------------------ */

    // Bytes entregues por minuto (métrica padrão e gratuita do CloudFront,
    // publicada em us-east-1, a mesma região desta stack). O CloudFront publica
    // com DUAS dimensões, DistributionId e Region=Global; o atalho
    // metricBytesDownloaded() do CDK só usa a primeira, e o alarme ficaria sem
    // dados (o disjuntor nunca dispararia). Por isso a métrica é montada à mão.
    const bytesEntregues = new cloudwatch.Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'BytesDownloaded',
      dimensionsMap: { DistributionId: distribuicao.distributionId, Region: 'Global' },
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.minutes(1),
    });
    const alarmeTrafego = new cloudwatch.Alarm(this, 'AlarmeTrafegoSite', {
      alarmDescription: 'O site entregou tráfego demais em 1 minuto: o disjuntor desliga a distribuição.',
      metric: bytesEntregues,
      threshold: LIMITE_DISJUNTOR_BYTES_POR_MINUTO,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING, // sem visitas não é alarme
    });

    // O alarme publica num tópico, e o tópico avisa a Lambda e, se houver, o e-mail.
    const topicoDisjuntor = new sns.Topic(this, 'TopicoDisjuntor', { displayName: 'Pijamoon: disjuntor do site' });
    alarmeTrafego.addAlarmAction(new cwActions.SnsAction(topicoDisjuntor));

    const funcaoDisjuntor = funcaoNode(this, 'FuncaoDisjuntor', {
      pasta: 'disjuntor',
      descricao: 'Desliga a distribuição do CloudFront quando o tráfego dispara (e religa à mão)',
      memoriaMb: 128,
      timeout: cdk.Duration.seconds(20),
      ambiente: { ID_DISTRIBUICAO: distribuicao.distributionId },
    });
    // Menor privilégio: ler e atualizar só esta distribuição.
    funcaoDisjuntor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:GetDistributionConfig', 'cloudfront:UpdateDistribution'],
        resources: [distribuicao.distributionArn],
      }),
    );
    topicoDisjuntor.addSubscription(new subs.LambdaSubscription(funcaoDisjuntor));
    if (props.emailAlertas) {
      topicoDisjuntor.addSubscription(new subs.EmailSubscription(props.emailAlertas));
    }

    apagarLogsNoDestroy(this);

    /* ------------------------------------------------------------------
     * Saídas
     * ------------------------------------------------------------------ */
    new cdk.CfnOutput(this, 'UrlLoja', { value: `https://${distribuicao.distributionDomainName}` });
    new cdk.CfnOutput(this, 'IdDistribuicao', { value: distribuicao.distributionId });
    new cdk.CfnOutput(this, 'NomeFuncaoDisjuntor', { value: funcaoDisjuntor.functionName });
  }
}
