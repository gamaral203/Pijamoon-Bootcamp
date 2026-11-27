import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { LIMITES_ALARMES } from '../lib/monitoramento';

const template = Template.fromStack(new PijamoonStack(new cdk.App(), 'TesteMonitoramento', { emailAlertas: 'teste@exemplo.com' }));

test('são só 3 alarmes (US$ 0,10 por mês cada)', () => {
  template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
});

test('alarma com qualquer mensagem na DLQ', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/SQS',
    MetricName: 'ApproximateNumberOfMessagesVisible',
    Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': [Match.stringLikeRegexp('DlqPedidos'), 'QueueName'] } }],
    Threshold: 0,
    ComparisonOperator: 'GreaterThanThreshold',
  });
});

test('alarma quando a fila de pedidos para de andar', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    MetricName: 'ApproximateAgeOfOldestMessage',
    Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': [Match.stringLikeRegexp('FilaPedidos'), 'QueueName'] } }],
    Threshold: LIMITES_ALARMES.idadeMaximaNaFila,
  });
});

test('alarma com erros 5xx na API', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/ApiGateway',
    MetricName: '5xx',
    Statistic: 'Sum',
    Threshold: LIMITES_ALARMES.errosDaApiEm5Min,
  });
});

test('todo alarme avisa o tópico quando dispara e quando volta ao normal', () => {
  for (const alarme of Object.values(template.findResources('AWS::CloudWatch::Alarm'))) {
    expect(alarme.Properties.AlarmActions).toEqual([{ Ref: expect.stringMatching(/TopicoAlertas/) }]);
    expect(alarme.Properties.OKActions).toEqual([{ Ref: expect.stringMatching(/TopicoAlertas/) }]);
    expect(alarme.Properties.TreatMissingData).toBe('notBreaching');
  }
  template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'teste@exemplo.com' });
});
