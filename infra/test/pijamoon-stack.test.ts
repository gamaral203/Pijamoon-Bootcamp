import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';

// Testes que rodam sem AWS: geram o template do CloudFormation e conferem o
// que a stack vai criar antes de qualquer deploy.
const template = Template.fromStack(new PijamoonStack(new cdk.App(), 'TesteStack'));

test('cria a tabela de produtos on-demand com o índice GSI1', () => {
  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
      },
    ],
  });
});

test('a tabela é apagada no cdk destroy', () => {
  template.hasResource('AWS::DynamoDB::GlobalTable', {
    DeletionPolicy: 'Delete',
  });
});

test('a Lambda do catálogo roda em Node.js 24 e recebe o nome da tabela', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs24.x',
    Handler: 'index.handler',
    Environment: { Variables: { TABLE_NAME: Match.anyValue() } },
  });
});

test('a Lambda do catálogo só tem permissão de leitura na tabela', () => {
  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { PolicyName: Match.stringLikeRegexp('FuncaoCatalogo') },
  });
  const acoes = Object.values(policies).flatMap((policy: any) =>
    policy.Properties.PolicyDocument.Statement.flatMap((s: any) => [s.Action].flat()),
  );
  expect(acoes).toContain('dynamodb:Query');
  expect(acoes.some((acao: string) => /Put|Update|Delete|BatchWrite/.test(acao))).toBe(false);
});

test('nenhum grupo de logs fica para trás no cdk destroy', () => {
  const grupos = Object.values(template.findResources('AWS::Logs::LogGroup'));
  expect(grupos.length).toBeGreaterThan(0);
  for (const grupo of grupos) {
    expect(grupo.DeletionPolicy).toBe('Delete');
    expect(grupo.Properties.RetentionInDays).toBe(7);
  }
});

test('expõe GET /api/products na API HTTP', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /api/products',
  });
});

test('o bucket do site é privado e só aceita HTTPS', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.hasResourceProperties('AWS::S3::BucketPolicy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
      ]),
    },
  });
});

test('o CloudFront acessa o bucket com Origin Access Control', () => {
  template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
});

test('o CloudFront serve o site e manda /api/* para a API, sem cache', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: 'index.html',
      DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      CacheBehaviors: [
        Match.objectLike({
          PathPattern: '/api/*',
          ViewerProtocolPolicy: 'redirect-to-https',
          // id da política gerenciada CachingDisabled
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        }),
      ],
    }),
  });
});

test('publica os arquivos do site e invalida o cache', () => {
  template.hasResourceProperties('Custom::CDKBucketDeployment', {
    DistributionPaths: ['/*'],
  });
});
