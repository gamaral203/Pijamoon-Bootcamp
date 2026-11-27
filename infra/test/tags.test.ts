import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { aplicarTagsDeCusto, TAGS_DE_CUSTO } from '../lib/regras';

// As tags são aplicadas no App, como no bin/pijamoon.ts.
const app = new cdk.App();
const stack = new PijamoonStack(app, 'TesteTags');
aplicarTagsDeCusto(app);
const template = Template.fromStack(stack);

test('a tabela, a Lambda e a API recebem as tags de custo do projeto', () => {
  const tagsEsperadas = Object.entries(TAGS_DE_CUSTO).map(([Key, Value]) => ({ Key, Value }));

  // Tabela e Lambda usam a lista Key/Value do CloudFormation.
  for (const tipo of ['AWS::DynamoDB::GlobalTable', 'AWS::Lambda::Function']) {
    for (const recurso of Object.values(template.findResources(tipo))) {
      const tags = recurso.Properties.Tags ?? recurso.Properties.Replicas?.[0]?.Tags;
      expect(tags).toEqual(expect.arrayContaining(tagsEsperadas));
    }
  }

  // A HTTP API usa um mapa { chave: valor }.
  template.hasResourceProperties('AWS::ApiGatewayV2::Api', { Tags: TAGS_DE_CUSTO });
});
