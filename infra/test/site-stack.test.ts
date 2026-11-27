import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { LIMITE_DISJUNTOR_BYTES_POR_MINUTO, SiteStack } from '../lib/site-stack';

// A stack do site recebe a API e o app client do back-end, como no bin/pijamoon.ts.
const app = new cdk.App();
const backend = new PijamoonStack(app, 'TesteBackend');
const template = Template.fromStack(
  new SiteStack(app, 'TesteSite', { api: backend.api, idClienteCognito: backend.idClienteCognito, emailAlertas: 'teste@exemplo.com' }),
);

test('não sobra nada do Amplify', () => {
  template.resourceCountIs('AWS::Amplify::App', 0);
  template.resourceCountIs('AWS::Amplify::Branch', 0);
});

test('o bucket do site é privado e só aceita HTTPS', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
  });
  template.hasResourceProperties('AWS::S3::BucketPolicy', {
    PolicyDocument: {
      Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]),
    },
  });
});

test('o CloudFront lê o bucket com Origin Access Control, a partir da pasta site/', () => {
  template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      Origins: Match.arrayWith([Match.objectLike({ OriginPath: '/site', S3OriginConfig: Match.anyValue() })]),
    }),
  });
});

test('serve o site com cache e manda /api/* para a API, sem cache e com todos os métodos', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: 'index.html',
      DefaultCacheBehavior: Match.objectLike({
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
      }),
      CacheBehaviors: [
        Match.objectLike({
          PathPattern: '/api/*',
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled
        }),
      ],
    }),
  });
  const [distribuicao] = Object.values(template.findResources('AWS::CloudFront::Distribution'));
  const metodosApi = distribuicao.Properties.DistributionConfig.CacheBehaviors[0].AllowedMethods;
  expect(metodosApi).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT'])); // catálogo, checkout e carrinho
});

test('publica o site e o js/config.js e limpa o cache do CloudFront', () => {
  const [copia] = Object.values(template.findResources('Custom::CDKBucketDeployment'));
  expect(copia.Properties.SourceObjectKeys).toHaveLength(2); // o site e o config.js
  expect(copia.Properties.DestinationBucketKeyPrefix).toBe('site');
  expect(copia.Properties.DistributionPaths).toEqual(['/*']);
  const marcadores = JSON.stringify(copia.Properties.SourceMarkers);
  expect(marcadores).toContain('AWS::Region');
  expect(marcadores).toMatch(/Fn::ImportValue.*ClienteSite/);
});

test('o alarme vigia os bytes entregues por minuto no CloudFront e avisa o tópico do disjuntor', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/CloudFront',
    MetricName: 'BytesDownloaded',
    // as DUAS dimensões que o CloudFront publica: sem a Region, o alarme fica sem dados
    Dimensions: Match.arrayWith([Match.objectLike({ Name: 'DistributionId' }), { Name: 'Region', Value: 'Global' }]),
    Statistic: 'Sum',
    Period: 60,
    Threshold: LIMITE_DISJUNTOR_BYTES_POR_MINUTO,
    TreatMissingData: 'notBreaching',
    AlarmActions: [Match.objectLike({ Ref: Match.stringLikeRegexp('TopicoDisjuntor') })],
  });
});

test('o tópico do disjuntor avisa a Lambda e o e-mail', () => {
  template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'lambda' });
  template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'teste@exemplo.com' });
});

test('a Lambda do disjuntor só pode ler e atualizar esta distribuição', () => {
  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { PolicyName: Match.stringLikeRegexp('FuncaoDisjuntor') },
  });
  const declaracoes = Object.values(policies).flatMap((p: any) => p.Properties.PolicyDocument.Statement);
  expect(declaracoes.flatMap((d: any) => [d.Action].flat()).sort()).toEqual(['cloudfront:GetDistributionConfig', 'cloudfront:UpdateDistribution']);
  expect(JSON.stringify(declaracoes[0].Resource)).toContain('distribution/');
});

test('nenhum grupo de logs fica para trás no cdk destroy', () => {
  for (const grupo of Object.values(template.findResources('AWS::Logs::LogGroup'))) {
    expect(grupo.DeletionPolicy).toBe('Delete');
    expect(grupo.Properties.RetentionInDays).toBe(7);
  }
});

describe('CloudFront Function: completa endereços de pasta', () => {
  // A função roda na borda (sem módulos); aqui ela é carregada como texto e executada.
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'funcoes', 'indice-de-pasta.js'), 'utf8');
  const handler = new Function(`${codigo}; return handler;`)();
  const uriDe = (uri: string) => handler({ request: { uri } }).uri;

  test.each([
    ['/', '/index.html'],
    ['/pedidos/', '/pedidos/index.html'],
    ['/pedidos', '/pedidos/index.html'],
    ['/produto/index.html', '/produto/index.html'],
    ['/css/style.css', '/css/style.css'],
    ['/img/produtos/CAMISOLA1.jpg', '/img/produtos/CAMISOLA1.jpg'],
  ])('%s → %s', (entrada, saida) => {
    expect(uriDe(entrada)).toBe(saida);
  });
});
