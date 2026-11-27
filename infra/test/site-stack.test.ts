import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { LIMITE_DISJUNTOR_BYTES_POR_MINUTO, SiteStack } from '../lib/site-stack';

// A stack do site recebe a API do back-end, como no bin/pijamoon.ts.
const app = new cdk.App();
const backend = new PijamoonStack(app, 'TesteBackend');
const template = Template.fromStack(
  new SiteStack(app, 'TesteSite', { api: backend.api, emailAlertas: 'teste@exemplo.com' }),
);

test('não usa CloudFront (bloqueado na conta do desafio)', () => {
  template.resourceCountIs('AWS::CloudFront::Distribution', 0);
});

test('cria o app do Amplify sem repositório e com /api/* encaminhado para a API', () => {
  template.hasResourceProperties('AWS::Amplify::App', {
    Platform: 'WEB',
    Repository: Match.absent(),
    CustomRules: [Match.objectLike({ Source: '/api/<*>', Status: '200', Target: Match.anyValue() })],
  });
  template.hasResourceProperties('AWS::Amplify::Branch', {
    BranchName: 'main',
    EnableAutoBuild: false,
  });
});

test('o bucket continua privado e só o Amplify lê os arquivos', () => {
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
        Match.objectLike({
          Effect: 'Allow',
          Principal: { Service: 'amplify.amazonaws.com' },
          Action: 's3:GetObject',
          Condition: { StringEquals: Match.objectLike({ 'aws:SourceAccount': Match.anyValue() }) },
        }),
      ]),
    },
  });
});

test('publica o site no Amplify a partir do bucket', () => {
  const [publicacao] = Object.values(template.findResources('Custom::AWS'));
  const chamada = JSON.stringify(publicacao.Properties.Create);
  expect(chamada).toContain('StartDeployment');
  expect(chamada).toContain('BUCKET_PREFIX');
});

test('o alarme vigia os bytes entregues por minuto e avisa o tópico do disjuntor', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/AmplifyHosting',
    MetricName: 'BytesDownloaded',
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

test('a Lambda do disjuntor só pode mudar a branch do site', () => {
  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { PolicyName: Match.stringLikeRegexp('FuncaoDisjuntor') },
  });
  const acoes = Object.values(policies).flatMap((policy: any) =>
    policy.Properties.PolicyDocument.Statement.flatMap((s: any) => [s.Action].flat()),
  );
  expect(acoes).toEqual(['amplify:UpdateBranch']);
});

test('nenhum grupo de logs fica para trás no cdk destroy', () => {
  for (const grupo of Object.values(template.findResources('AWS::Logs::LogGroup'))) {
    expect(grupo.DeletionPolicy).toBe('Delete');
    expect(grupo.Properties.RetentionInDays).toBe(7);
  }
});
