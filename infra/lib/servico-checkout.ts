import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { funcaoNode } from './funcao';

export interface ServicoCheckoutProps {
  readonly api: apigwv2.HttpApi;
  /** Onde o evento "PedidoRecebido" é publicado. */
  readonly barramento: events.IEventBus;
  /** O catálogo, só para ler nomes e preços (o checkout nunca escreve nele). */
  readonly tabelaProdutos: dynamodb.ITableV2;
}

/**
 * Serviço de checkout: POST /api/checkout.
 *
 * Recebe o pedido, valida com os preços do catálogo, publica o evento
 * "PedidoRecebido" e responde 202 Accepted. Ele não tem tabela própria e não
 * sabe quem vai consumir o evento: o serviço de pedidos hoje, e outros amanhã
 * (como o extra com Bedrock), sem mudar uma linha daqui.
 */
export class ServicoCheckout extends Construct {
  public readonly funcao: lambda.Function;

  constructor(escopo: Construct, id: string, props: ServicoCheckoutProps) {
    super(escopo, id);

    this.funcao = funcaoNode(this, 'FuncaoCheckout', {
      pasta: 'checkout',
      descricao: 'Recebe o pedido e publica o evento PedidoRecebido (POST /api/checkout)',
      ambiente: {
        TABELA_PRODUTOS: props.tabelaProdutos.tableName,
        NOME_BARRAMENTO: props.barramento.eventBusName,
      },
    });

    // Menor privilégio: lê o catálogo e publica eventos neste barramento. Só.
    props.tabelaProdutos.grantReadData(this.funcao);
    props.barramento.grantPutEventsTo(this.funcao);

    props.api.addRoutes({
      path: '/api/checkout',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('IntegracaoCheckout', this.funcao),
    });
  }
}
