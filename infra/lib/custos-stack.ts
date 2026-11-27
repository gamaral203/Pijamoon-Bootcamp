import * as cdk from 'aws-cdk-lib/core';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface CustosStackProps extends cdk.StackProps {
  /** Quem recebe os alertas por e-mail. */
  readonly emailAlertas: string;
  /** Teto mensal da conta, em dólares. */
  readonly limiteMensalUsd: number;
}

/** Em quais porcentagens do limite o gasto real dispara um alerta. */
export const ALERTAS_GASTO_REAL = [25, 50, 80, 100];

/**
 * Alerta de custo da conta: um orçamento mensal no AWS Budgets que avisa
 * por e-mail antes de estourar o teto.
 *
 * Fica numa stack própria porque não depende de nada da loja: ela sobe
 * primeiro numa conta nova, antes de qualquer outro recurso, e continua
 * vigiando mesmo se a loja for removida com `cdk destroy`.
 *
 * O Budgets só avisa, ele não desliga nada. Quem segura o gasto é o desenho
 * da arquitetura (só serviços cobrados por uso) e o throttling da API.
 */
export class CustosStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CustosStackProps) {
    super(scope, id, props);

    const destinatario = [{ subscriptionType: 'EMAIL', address: props.emailAlertas }];

    // O Budgets não tem construct L2 no CDK, então este é o L1 (CfnBudget),
    // que é o recurso AWS::Budgets::Budget do CloudFormation direto.
    new budgets.CfnBudget(this, 'OrcamentoMensal', {
      budget: {
        budgetName: 'pijamoon-limite-mensal',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.limiteMensalUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        // Gasto real: avisa quando o mês já consumiu cada fatia do limite.
        ...ALERTAS_GASTO_REAL.map((porcentagem) => ({
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: porcentagem,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: destinatario,
        })),
        // Previsão: a AWS projeta o fim do mês pelo ritmo atual. Este alerta
        // chega antes do problema, quando ainda dá tempo de reagir.
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: destinatario,
        },
      ],
    });
  }
}
