import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
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
