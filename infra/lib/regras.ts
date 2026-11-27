import * as cdk from 'aws-cdk-lib/core';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Regra para uma stack inteira: todo grupo de logs (inclusive os que o CDK
 * cria por conta própria, como os das Lambdas internas de custom resources)
 * guarda uma semana e é apagado no `cdk destroy`, em vez de ficar para trás
 * cobrando armazenamento.
 *
 * É um Aspect: o CDK passa por todos os constructs da stack antes de gerar
 * o template e aplica o ajuste em cada um que for um grupo de logs.
 */
export function apagarLogsNoDestroy(escopo: Construct): void {
  cdk.Aspects.of(escopo).add({
    visit(node) {
      if (node instanceof logs.CfnLogGroup) {
        node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
        node.retentionInDays = logs.RetentionDays.ONE_WEEK;
      }
    },
  });
}

/** As etiquetas de custo de todos os recursos da Pijamoon. */
export const TAGS_DE_CUSTO = {
  projeto: 'pijamoon',
  desafio: 'desafio-1-commerce-serverless',
  'gerenciado-por': 'cdk',
};

/**
 * Tags de custo: o CDK coloca estas etiquetas em todo recurso do escopo
 * (aplicado no App, chega em todas as stacks). No Billing, dá para filtrar
 * o gasto por elas e ver quanto a Pijamoon custa, separado do resto da conta.
 */
export function aplicarTagsDeCusto(escopo: Construct): void {
  for (const [chave, valor] of Object.entries(TAGS_DE_CUSTO)) {
    cdk.Tags.of(escopo).add(chave, valor);
  }
}
