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

test('o checkout e as consultas de pedidos exigem o token do Cognito', () => {
  for (const rota of ['POST /api/checkout', 'GET /api/orders', 'GET /api/orders/{pedidoId}']) {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: rota,
      AuthorizationType: 'JWT',
      AuthorizerId: Match.anyValue(),
    });
  }
});

test('o catálogo continua aberto, sem login', () => {
  const [rota] = Object.values(
    template.findResources('AWS::ApiGatewayV2::Route', { Properties: { RouteKey: 'GET /api/products' } }),
  );
  expect(rota.Properties.AuthorizationType ?? 'NONE').toBe('NONE');
});

test('a tabela de pedidos tem o índice por cliente (GSI1)', () => {
  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    GlobalSecondaryIndexes: [
      Match.objectLike({ IndexName: 'GSI1', KeySchema: [{ AttributeName: 'GSI1PK', KeyType: 'HASH' }, { AttributeName: 'GSI1SK', KeyType: 'RANGE' }] }),
    ],
    KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' }],
    TableName: Match.absent(),
  });
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

test('cada serviço tem a sua tabela, on-demand e apagada no cdk destroy', () => {
  const tabelas = Object.values(template.findResources('AWS::DynamoDB::GlobalTable'));
  expect(tabelas).toHaveLength(3); // produtos, pedidos e mensagens: uma por serviço
  for (const tabela of tabelas) {
    expect(tabela.DeletionPolicy).toBe('Delete');
    expect(tabela.Properties.BillingMode).toBe('PAY_PER_REQUEST');
  }
});

test('o PedidoRecebido tem dois consumidores: a fila de pedidos e a de mensagens (fan-out)', () => {
  const regras = Object.values(template.findResources('AWS::Events::Rule'));
  expect(regras).toHaveLength(2);
  const alvos = regras.map((r: any) => JSON.stringify(r.Properties.Targets[0].Arn));
  expect(alvos.some((a: string) => a.includes('FilaPedidos'))).toBe(true);
  expect(alvos.some((a: string) => a.includes('FilaMensagens'))).toBe(true);
});

test('a Lambda de mensagens só pode invocar o modelo Nova Micro', () => {
  const policies = template.findResources('AWS::IAM::Policy', {
    Properties: { PolicyName: Match.stringLikeRegexp('FuncaoGeraMensagem') },
  });
  const declaracao = Object.values(policies)
    .flatMap((p: any) => p.Properties.PolicyDocument.Statement)
    .find((d: any) => d.Action === 'bedrock:InvokeModel');
  expect(JSON.stringify(declaracao.Resource)).toContain('foundation-model/amazon.nova-micro-v1:0');
});

test('a mensagem do pedido exige login', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /api/orders/{pedidoId}/mensagem',
    AuthorizationType: 'JWT',
  });
});
