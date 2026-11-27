import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ALERTAS_GASTO_REAL, CustosStack } from '../lib/custos-stack';

const template = Template.fromStack(
  new CustosStack(new cdk.App(), 'TesteCustos', { emailAlertas: 'teste@exemplo.com', limiteMensalUsd: 20 }),
);

test('cria um orçamento mensal de US$ 20', () => {
  template.hasResourceProperties('AWS::Budgets::Budget', {
    Budget: Match.objectLike({
      BudgetType: 'COST',
      TimeUnit: 'MONTHLY',
      BudgetLimit: { Amount: 20, Unit: 'USD' },
    }),
  });
});

test('avisa por e-mail em 25, 50, 80 e 100% do gasto real e na previsão de estouro', () => {
  const [orcamento] = Object.values(template.findResources('AWS::Budgets::Budget'));
  const alertas = orcamento.Properties.NotificationsWithSubscribers;

  const reais = alertas.filter((a: any) => a.Notification.NotificationType === 'ACTUAL');
  expect(reais.map((a: any) => a.Notification.Threshold)).toEqual(ALERTAS_GASTO_REAL);

  const previsao = alertas.filter((a: any) => a.Notification.NotificationType === 'FORECASTED');
  expect(previsao.map((a: any) => a.Notification.Threshold)).toEqual([100]);

  for (const alerta of alertas) {
    expect(alerta.Subscribers).toEqual([{ SubscriptionType: 'EMAIL', Address: 'teste@exemplo.com' }]);
  }
});
