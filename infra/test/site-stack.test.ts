import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { SiteStack } from '../lib/site-stack';

// A stack do site recebe a API do back-end, como no bin/pijamoon.ts.
const app = new cdk.App();
const backend = new PijamoonStack(app, 'TesteBackend');
const template = Template.fromStack(new SiteStack(app, 'TesteSite', { api: backend.api }));

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
