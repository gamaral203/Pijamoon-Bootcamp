import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * A stack da Pijamoon: tudo o que ela declara sobe junto num `cdk deploy`
 * e desce junto num `cdk destroy`.
 */
export class PijamoonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tabela do catálogo, com o mesmo desenho da Fase 1:
    //   PK = PRODUCT#<id>, SK = META   → um item por produto
    //   GSI1PK = CATALOG               → listar o catálogo com Query, sem Scan
    const tabelaProdutos = new dynamodb.TableV2(this, 'TabelaProdutos', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        },
      ],
      // O padrão do CDK é RETAIN: o `cdk destroy` não apaga a tabela, para
      // não perder dados de produção. Neste projeto de estudo a tabela é
      // recriada a cada deploy, então ela pode ser apagada junto com a stack.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Aparece no terminal no fim do deploy (e na aba Outputs do CloudFormation).
    new cdk.CfnOutput(this, 'NomeTabelaProdutos', {
      value: tabelaProdutos.tableName,
    });
  }
}
