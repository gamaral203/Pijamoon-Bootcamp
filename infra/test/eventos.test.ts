import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { EVENTO_PEDIDO, TENTATIVAS_ANTES_DA_DLQ } from '../lib/servico-pedidos';

const template = Template.fromStack(new PijamoonStack(new cdk.App(), 'TesteEventos'));

/** Junta todas as ações IAM das policies de uma Lambda, pelo nome lógico. */
function acoesDa(nomeLogico: string): string[] {
  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { PolicyName: Match.stringLikeRegexp(nomeLogico) },
  });
  return Object.values(policies).flatMap((policy: any) =>
    policy.Properties.PolicyDocument.Statement.flatMap((s: any) => [s.Action].flat()),
  );
}

test('expõe POST /api/checkout e GET /api/orders/{pedidoId}', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'POST /api/checkout' });
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /api/orders/{pedidoId}' });
});

test('cria um barramento de eventos próprio da loja', () => {
  template.resourceCountIs('AWS::Events::EventBus', 1);
});

test('a regra leva o PedidoRecebido do checkout para a fila de pedidos', () => {
  template.hasResourceProperties('AWS::Events::Rule', {
    EventBusName: Match.anyValue(),
    EventPattern: { source: [EVENTO_PEDIDO.source], 'detail-type': [EVENTO_PEDIDO.detailType] },
    Targets: [Match.objectLike({ Arn: { 'Fn::GetAtt': [Match.stringLikeRegexp('FilaPedidos'), 'Arn'] } })],
  });
});

test('a fila manda para a DLQ depois de 3 tentativas', () => {
  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 60,
    RedrivePolicy: {
      deadLetterTargetArn: { 'Fn::GetAtt': [Match.stringLikeRegexp('DlqPedidos'), 'Arn'] },
      maxReceiveCount: TENTATIVAS_ANTES_DA_DLQ,
    },
  });
  template.hasResourceProperties('AWS::SQS::Queue', { MessageRetentionPeriod: 14 * 24 * 60 * 60 });
});

test('a Lambda de pedidos lê a fila em lotes, com falha parcial e concorrência limitada', () => {
  template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
    BatchSize: 10,
    FunctionResponseTypes: ['ReportBatchItemFailures'],
    ScalingConfig: { MaximumConcurrency: 2 },
  });
});

test('o checkout só lê o catálogo e publica eventos: não grava em tabela nenhuma', () => {
  const acoes = acoesDa('FuncaoCheckout');
  expect(acoes).toContain('events:PutEvents');
  expect(acoes).toContain('dynamodb:Query');
  expect(acoes.some((acao) => /Put(Item)?$|Update|Delete|BatchWrite/.test(acao) && acao.startsWith('dynamodb'))).toBe(false);
});

test('a consulta de pedidos só lê', () => {
  const acoes = acoesDa('FuncaoConsultaPedido');
  expect(acoes).toContain('dynamodb:GetItem');
  expect(acoes.some((acao) => /PutItem|UpdateItem|DeleteItem|BatchWrite/.test(acao))).toBe(false);
});

test('a tabela de pedidos é on-demand e apagada no cdk destroy', () => {
  const tabelas = Object.values(template.findResources('AWS::DynamoDB::GlobalTable'));
  expect(tabelas).toHaveLength(2); // produtos e pedidos, uma por serviço
  for (const tabela of tabelas) {
    expect(tabela.DeletionPolicy).toBe('Delete');
    expect(tabela.Properties.BillingMode).toBe('PAY_PER_REQUEST');
  }
});
