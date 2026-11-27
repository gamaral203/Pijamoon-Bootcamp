import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { funcaoNode } from './funcao';

/** Quantas vezes a fila tenta entregar uma mensagem antes de mandá-la para a DLQ. */
export const TENTATIVAS_ANTES_DA_DLQ = 3;

/** O evento que o checkout publica e o serviço de pedidos consome. */
export const EVENTO_PEDIDO = { source: 'pijamoon.checkout', detailType: 'PedidoRecebido' };

export interface ServicoPedidosProps {
  readonly api: apigwv2.HttpApi;
  readonly barramento: events.IEventBus;
}

/**
 * Serviço de pedidos: cria os pedidos a partir do evento e responde
 * GET /api/orders/{pedidoId}.
 *
 *   EventBridge (regra) → fila SQS → Lambda processa → tabela de pedidos
 *                           └─ depois de 3 falhas → DLQ
 *
 * A tabela de pedidos é só deste serviço: ninguém mais grava nela.
 */
export class ServicoPedidos extends Construct {
  public readonly tabela: dynamodb.TableV2;
  public readonly fila: sqs.Queue;
  public readonly dlq: sqs.Queue;
  public readonly funcaoProcessa: lambda.Function;
  public readonly funcaoConsulta: lambda.Function;

  constructor(escopo: Construct, id: string, props: ServicoPedidosProps) {
    super(escopo, id);

    // Tabela de pedidos: PK = PEDIDO#<id>, SK = META (o mesmo desenho do catálogo).
    this.tabela = new dynamodb.TableV2(this, 'TabelaPedidos', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // projeto de estudo
    });

    /* ------------------------------------------------------------------
     * Fila + DLQ: a "fila de comandas" e a "gaveta de problemas"
     * ------------------------------------------------------------------ */

    // A DLQ guarda as mensagens que falharam todas as tentativas, por 14
    // dias (o máximo), para dar tempo de investigar e reprocessar.
    this.dlq = new sqs.Queue(this, 'DlqPedidos', {
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    this.fila = new sqs.Queue(this, 'FilaPedidos', {
      // Enquanto a Lambda processa, a mensagem fica invisível para as outras.
      // A AWS recomenda pelo menos 6x o timeout da Lambda (10 s): se ela
      // travar, a mensagem só reaparece depois que a tentativa acabou mesmo.
      visibilityTimeout: cdk.Duration.seconds(60),
      enforceSSL: true,
      deadLetterQueue: { queue: this.dlq, maxReceiveCount: TENTATIVAS_ANTES_DA_DLQ },
    });

    // A regra do EventBridge: todo "PedidoRecebido" vindo do checkout vai
    // para a fila. O CDK também cria a permissão para o EventBridge escrever
    // nela (a policy da fila).
    new events.Rule(this, 'RegraPedidoRecebido', {
      eventBus: props.barramento,
      description: 'Leva cada PedidoRecebido para a fila do serviço de pedidos',
      eventPattern: { source: [EVENTO_PEDIDO.source], detailType: [EVENTO_PEDIDO.detailType] },
      targets: [new targets.SqsQueue(this.fila)],
    });

    /* ------------------------------------------------------------------
     * Lambda que processa a fila
     * ------------------------------------------------------------------ */
    this.funcaoProcessa = funcaoNode(this, 'FuncaoProcessaPedidos', {
      pasta: 'pedidos-processa',
      descricao: 'Lê a fila de pedidos e grava cada pedido uma vez só',
      ambiente: { TABELA_PEDIDOS: this.tabela.tableName },
    });
    // Só precisa gravar (PutItem com condição), não ler a tabela inteira.
    this.tabela.grantWriteData(this.funcaoProcessa);

    // O "event source mapping": a própria AWS fica lendo a fila e chama a
    // Lambda com lotes de até 10 mensagens. Com reportBatchItemFailures, só
    // as mensagens que falharam voltam para a fila. maxConcurrency limita a
    // 2 Lambdas ao mesmo tempo: segura o custo e protege a tabela num pico.
    this.funcaoProcessa.addEventSource(
      new SqsEventSource(this.fila, {
        batchSize: 10,
        reportBatchItemFailures: true,
        maxConcurrency: 2,
      }),
    );

    /* ------------------------------------------------------------------
     * Lambda que consulta um pedido
     * ------------------------------------------------------------------ */
    this.funcaoConsulta = funcaoNode(this, 'FuncaoConsultaPedido', {
      pasta: 'pedidos-consulta',
      descricao: 'Consulta um pedido pelo número (GET /api/orders/{pedidoId})',
      ambiente: { TABELA_PEDIDOS: this.tabela.tableName },
    });
    this.tabela.grantReadData(this.funcaoConsulta);

    props.api.addRoutes({
      path: '/api/orders/{pedidoId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('IntegracaoConsultaPedido', this.funcaoConsulta),
    });
  }
}
