import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { apagarLogsNoDestroy } from './regras';

const RAIZ = path.join(__dirname, '..', '..');

export interface SiteStackProps extends cdk.StackProps {
  /** A API do back-end (PijamoonStack), para encaminhar /api/*. */
  readonly api: apigwv2.IHttpApi;
}

/**
 * A hospedagem do site: bucket privado → CloudFront → arquivos de site/.
 *
 * Fica numa stack separada do back-end porque a forma de hospedar depende
 * da conta: a conta do desafio bloqueia o CloudFront, então esta parte vai
 * ser trocada sem mexer no catálogo, na API ou nas tabelas.
 */
export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    // Bucket privado: ninguém acessa direto, só o CloudFront (via OAC).
    const bucketSite = new s3.Bucket(this, 'BucketSite', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Projeto de estudo: no `cdk destroy`, esvazia e apaga o bucket.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // O endereço da API sem o "https://", que é o que o CloudFront espera.
    const dominioApi = `${props.api.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

    // Uma entrada só para a loja inteira: o mesmo domínio serve o site e a
    // API, então o navegador não precisa de CORS (como na Fase 1).
    const distribuicao = new cloudfront.Distribution(this, 'DistribuicaoSite', {
      comment: 'Pijamoon: site e API',
      defaultRootObject: 'index.html',
      // Comportamento padrão: arquivos do site, vindos do bucket e com cache.
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucketSite),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // /api/*: encaminha para o API Gateway, sem cache na borda (o cache
        // do catálogo fica no navegador e na memória da Lambda).
        '/api/*': {
          origin: new origins.HttpOrigin(dominioApi, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Repassa query string, headers e corpo, menos o Host: o API Gateway
          // precisa receber o próprio domínio, não o do CloudFront.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // o checkout vai usar POST
        },
      },
    });

    // Publica os arquivos de site/ no bucket e limpa o cache do CloudFront.
    // O site precisa estar compilado (site/js/ é gerado pelo tsc e não vai pro Git).
    const pastaSite = path.join(RAIZ, 'site');
    if (!fs.existsSync(path.join(pastaSite, 'js', 'shared.js'))) {
      throw new Error('site/js/ não existe: rode "npm run build" dentro de site/ antes do deploy.');
    }
    new s3deploy.BucketDeployment(this, 'PublicacaoSite', {
      sources: [
        s3deploy.Source.asset(pastaSite, {
          // Só o que o navegador usa: fica de fora o código-fonte e a configuração.
          exclude: ['ts', 'node_modules', 'dist', 'package.json', 'package-lock.json', 'tsconfig.json', '*.map'],
        }),
      ],
      destinationBucket: bucketSite,
      distribution: distribuicao,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    apagarLogsNoDestroy(this);

    new cdk.CfnOutput(this, 'UrlLoja', { value: `https://${distribuicao.distributionDomainName}` });
  }
}
