// Testa as Lambdas de pedidos sem AWS: o DynamoDB é um falso em memória que
// respeita a condição attribute_not_exists, como o de verdade.
const tabela = new Map<string, any>();
const enviar = jest.fn();

jest.mock(
  '@aws-sdk/client-dynamodb',
  () => {
    class ConditionalCheckFailedException extends Error {
      name = 'ConditionalCheckFailedException';
    }
    return { DynamoDBClient: jest.fn(), ConditionalCheckFailedException };
  },
  { virtual: true },
);
jest.mock(
  '@aws-sdk/lib-dynamodb',
  () => ({
    DynamoDBDocumentClient: { from: () => ({ send: enviar }) },
    PutCommand: jest.fn((e) => ({ tipo: 'put', ...e })),
    GetCommand: jest.fn((e) => ({ tipo: 'get', ...e })),
  }),
  { virtual: true },
);

process.env.TABELA_PEDIDOS = 'pedidos';
/* eslint-disable @typescript-eslint/no-require-imports */
const { ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const processa = require('../../backend/pedidos-processa/index.mjs');
const consulta = require('../../backend/pedidos-consulta/index.mjs');
/* eslint-enable @typescript-eslint/no-require-imports */

const ID = '3f2b8c1e-9d4a-4e6f-8b7c-1a2b3c4d5e6f';
const pedido = (pedidoId = ID) => ({ pedidoId, criadoEm: '2026-11-27T12:00:00Z', total: 79.9, itens: [] });
/** Uma mensagem do SQS do jeito que chega: o corpo é o evento do EventBridge. */
const mensagem = (id: string, detail: any) => ({
  messageId: id,
  body: JSON.stringify({ 'detail-type': 'PedidoRecebido', detail }),
});

beforeEach(() => {
  tabela.clear();
  enviar.mockReset().mockImplementation(async (comando: any) => {
    const chave = `${comando.Key?.PK ?? comando.Item?.PK}|${comando.Key?.SK ?? comando.Item?.SK}`;
    if (comando.tipo === 'get') return { Item: tabela.get(chave) };
    if (comando.ConditionExpression === 'attribute_not_exists(PK)' && tabela.has(chave)) {
      throw new ConditionalCheckFailedException('já existe');
    }
    tabela.set(chave, comando.Item);
    return {};
  });
});

describe('processa pedidos', () => {
  test('grava o pedido como CONFIRMADO', async () => {
    const resultado = await processa.handler({ Records: [mensagem('m1', pedido())] });

    expect(resultado).toEqual({ batchItemFailures: [] });
    expect(tabela.get(`PEDIDO#${ID}|META`)).toMatchObject({ pedidoId: ID, status: 'CONFIRMADO', total: 79.9 });
  });

  test('a mesma mensagem entregue duas vezes não cria dois pedidos (idempotência)', async () => {
    await processa.handler({ Records: [mensagem('m1', pedido())] });
    const primeiraGravacao = tabela.get(`PEDIDO#${ID}|META`);

    const resultado = await processa.handler({ Records: [mensagem('m1-repetida', pedido())] });

    expect(resultado).toEqual({ batchItemFailures: [] }); // repetição não é erro
    expect(tabela.size).toBe(1);
    expect(tabela.get(`PEDIDO#${ID}|META`)).toBe(primeiraGravacao); // o original fica intacto
  });

  test('num lote, só a mensagem com problema volta para a fila', async () => {
    const outroId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    const resultado = await processa.handler({
      Records: [
        mensagem('boa-1', pedido()),
        { messageId: 'quebrada', body: '{nao e json' },
        mensagem('boa-2', pedido(outroId)),
      ],
    });

    expect(resultado).toEqual({ batchItemFailures: [{ itemIdentifier: 'quebrada' }] });
    expect(tabela.size).toBe(2);
  });

  test('um erro do banco devolve a mensagem para a fila tentar de novo', async () => {
    enviar.mockRejectedValue(new Error('DynamoDB fora do ar'));
    const resultado = await processa.handler({ Records: [mensagem('m1', pedido())] });
    expect(resultado).toEqual({ batchItemFailures: [{ itemIdentifier: 'm1' }] });
  });
});

describe('consulta pedido', () => {
  test('devolve o pedido sem as chaves do banco', async () => {
    tabela.set(`PEDIDO#${ID}|META`, { PK: `PEDIDO#${ID}`, SK: 'META', pedidoId: ID, status: 'CONFIRMADO' });
    const resposta = await consulta.handler({ pathParameters: { pedidoId: ID } });

    expect(resposta.statusCode).toBe(200);
    expect(JSON.parse(resposta.body)).toEqual({ pedidoId: ID, status: 'CONFIRMADO' });
  });

  test('responde 404 enquanto o pedido ainda não foi processado', async () => {
    expect((await consulta.handler({ pathParameters: { pedidoId: ID } })).statusCode).toBe(404);
  });

  test('responde 400 para um número que não é UUID, sem ir ao banco', async () => {
    expect((await consulta.handler({ pathParameters: { pedidoId: '../../etc' } })).statusCode).toBe(400);
    expect(enviar).not.toHaveBeenCalled();
  });
});
