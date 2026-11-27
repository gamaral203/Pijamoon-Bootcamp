import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

/** Limites dos alarmes, em um lugar só (os testes usam os mesmos valores). */
export const LIMITES_ALARMES = {
  /** A mensagem mais velha da fila pode esperar no máximo isto (segundos). */
  idadeMaximaNaFila: 300,
  /** Quantas respostas 5xx da API em 5 minutos já indicam um problema. */
  errosDaApiEm5Min: 5,
};

export interface MonitoramentoProps {
  readonly api: apigwv2.HttpApi;
  readonly filaPedidos: sqs.IQueue;
  readonly dlqPedidos: sqs.IQueue;
  /** Opcional: quem recebe os alarmes por e-mail. */
  readonly emailAlertas?: string;
}

/**
 * Alarmes do back-end: avisam por e-mail quando algo quebra, em vez de o
 * problema ficar escondido (por exemplo, um pedido parado na DLQ).
 *
 *   alarme (CloudWatch) → tópico SNS → e-mail
 *
 * São só 3 alarmes (US$ 0,10 por mês cada), escolhidos para cobrir o que
 * importa com pouco: o lado assíncrono (DLQ e fila parada) e a API inteira
 * (uma métrica de 5xx cobre todas as rotas). Um dashboard ficou de fora:
 * custa US$ 3 por mês, caro para o teto de US$ 20.
 */
export class Monitoramento extends Construct {
  public readonly topico: sns.Topic;
  public readonly alarmes: cloudwatch.Alarm[];

  constructor(escopo: Construct, id: string, props: MonitoramentoProps) {
    super(escopo, id);

    this.topico = new sns.Topic(this, 'TopicoAlertas', { displayName: 'Pijamoon: alertas do back-end' });
    if (props.emailAlertas) {
      this.topico.addSubscription(new subs.EmailSubscription(props.emailAlertas));
    }

    const cincoMinutos = cdk.Duration.minutes(5);

    this.alarmes = [
      // 1. Qualquer mensagem na DLQ: um pedido falhou 3 vezes e precisa de
      //    alguém olhando (ver o log da Lambda de pedidos e fazer o redrive).
      new cloudwatch.Alarm(this, 'AlarmeDlqComMensagem', {
        alarmDescription: 'Há pedido na DLQ: falhou 3 vezes no processamento. Veja o log da Lambda de pedidos.',
        metric: props.dlqPedidos.metric('ApproximateNumberOfMessagesVisible', {
          statistic: cloudwatch.Stats.MAXIMUM,
          period: cincoMinutos,
        }),
        threshold: 0,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 2. Fila parada: se a mensagem mais velha passa de 5 minutos, a Lambda
      //    parou de consumir (erro, permissão, mapeamento desligado...) e os
      //    pedidos estão se acumulando sem virar pedido.
      new cloudwatch.Alarm(this, 'AlarmeFilaParada', {
        alarmDescription: 'Pedidos esperando há mais de 5 min na fila: a Lambda de pedidos parou de consumir.',
        metric: props.filaPedidos.metric('ApproximateAgeOfOldestMessage', {
          statistic: cloudwatch.Stats.MAXIMUM,
          period: cincoMinutos,
        }),
        threshold: LIMITES_ALARMES.idadeMaximaNaFila,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 3. Erros na API: respostas 5xx (erro do nosso lado, não do cliente)
      //    em qualquer rota. Um erro isolado acontece; 5 em 5 minutos, não.
      new cloudwatch.Alarm(this, 'AlarmeErrosApi', {
        alarmDescription: 'A API respondeu 5 ou mais erros 5xx em 5 minutos.',
        metric: props.api.metricServerError({ statistic: cloudwatch.Stats.SUM, period: cincoMinutos }),
        threshold: LIMITES_ALARMES.errosDaApiEm5Min,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),
    ];

    // Avisa quando o alarme dispara e também quando volta ao normal: assim
    // dá para saber que o problema foi resolvido sem abrir o console.
    for (const alarme of this.alarmes) {
      alarme.addAlarmAction(new cwActions.SnsAction(this.topico));
      alarme.addOkAction(new cwActions.SnsAction(this.topico));
    }
  }
}
