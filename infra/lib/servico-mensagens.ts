import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { funcaoNode } from './funcao';
import { EVENTO_PEDIDO, TENTATIVAS_ANTES_DA_DLQ } from './servico-pedidos';

/** Mensagens geradas pelo Bedrock por dia, no máximo. Acima disso, mensagem padrão. */
export const LIMITE_DIARIO_MENSAGENS = 200;

export interface ServicoMensagensProps {
  readonly api: apigwv2.HttpApi;
  readonly barramento: events.IEventBus;
  readonly authorizer: apigwv2.IHttpRouteAuthorizer;
}

/**
 * Serviço de mensagens (extra): um recado personalizado para cada pedido,
 * escrito pelo Amazon Bedrock (modelo Amazon Nova Micro, o mais barato).
 *
 *   PedidoRecebido ─┬─▶ regra → fila de pedidos   → ...            (serviço de pedidos)
 *                   └─▶ regra → fila de mensagens → Lambda → Bedrock → tabela de mensagens
 *
 * É o segundo consumidor do mesmo evento: o checkout não mudou nada para este
 * serviço existir. Tabela, fila e Lambdas são só dele.
 */
export class ServicoMensagens extends Construct {
  public readonly tabela: dynamodb.TableV2;
  public readonly fila: sqs.Queue;
  public readonly dlq: sqs.Queue;
  public readonly funcaoGera: lambda.Function;

  constructor(escopo: Construct, id: string, props: ServicoMensagensProps) {
    super(escopo, id);

    // PK = PEDIDO#<id>, SK = MENSAGEM → a mensagem de cada pedido
    // PK = CONTADOR#<dia>, SK = BEDROCK → quantas mensagens o Bedrock já escreveu hoje
    this.tabela = new dynamodb.TableV2(this, 'TabelaMensagens', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'expiraEm', // os contadores diários somem sozinhos
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.dlq = new sqs.Queue(this, 'DlqMensagens', { retentionPeriod: cdk.Duration.days(14), enforceSSL: true });
    this.fila = new sqs.Queue(this, 'FilaMensagens', {
      visibilityTimeout: cdk.Duration.seconds(120), // 6x o timeout da Lambda (20 s)
      enforceSSL: true,
      deadLetterQueue: { queue: this.dlq, maxReceiveCount: TENTATIVAS_ANTES_DA_DLQ },
    });

    // A mesma regra de evento do serviço de pedidos, com outro alvo: cada
    // regra entrega a sua própria cópia do evento (fan-out).
    new events.Rule(this, 'RegraPedidoRecebido', {
      eventBus: props.barramento,
      description: 'Leva cada PedidoRecebido também para a fila do serviço de mensagens (Bedrock)',
      eventPattern: { source: [EVENTO_PEDIDO.source], detailType: [EVENTO_PEDIDO.detailType] },
      targets: [new targets.SqsQueue(this.fila)],
    });

    const modelo = bedrock.FoundationModel.fromFoundationModelId(
      this,
      'ModeloNovaMicro',
      bedrock.FoundationModelIdentifier.AMAZON_NOVA_MICRO_V1_0,
    );

    this.funcaoGera = funcaoNode(this, 'FuncaoGeraMensagem', {
      pasta: 'mensagens-gera',
      descricao: 'Escreve a mensagem personalizada do pedido com o Amazon Bedrock',
      timeout: cdk.Duration.seconds(20),
      ambiente: {
        TABELA_MENSAGENS: this.tabela.tableName,
        MODELO_BEDROCK: modelo.modelId,
        LIMITE_DIARIO: String(LIMITE_DIARIO_MENSAGENS),
      },
    });
    this.tabela.grantReadWriteData(this.funcaoGera);
    // Menor privilégio: invocar só este modelo, e mais nenhum.
    this.funcaoGera.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: [modelo.modelArn] }),
    );
    this.funcaoGera.addEventSource(
      new SqsEventSource(this.fila, { batchSize: 5, reportBatchItemFailures: true, maxConcurrency: 2 }),
    );

    const funcaoConsulta = funcaoNode(this, 'FuncaoConsultaMensagem', {
      pasta: 'mensagens-consulta',
      descricao: 'Devolve a mensagem do pedido ao dono (GET /api/orders/{pedidoId}/mensagem)',
      ambiente: { TABELA_MENSAGENS: this.tabela.tableName },
    });
    this.tabela.grantReadData(funcaoConsulta);

    props.api.addRoutes({
      path: '/api/orders/{pedidoId}/mensagem',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('IntegracaoConsultaMensagem', funcaoConsulta),
      authorizer: props.authorizer,
    });
  }
}
