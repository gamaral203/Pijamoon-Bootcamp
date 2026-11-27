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
    QueryCommand: jest.fn((e) => ({ tipo: 'query', ...e })),
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
const pedido = (pedidoId = ID, clienteId = 'sub-ana', criadoEm = '2026-11-27T12:00:00Z') => ({
  pedidoId,
  criadoEm,
  cliente: { id: clienteId, nome: 'Ana', email: 'ana@exemplo.com' },
  total: 79.9,
  itens: [],
});
/** Um evento do API Gateway depois do JWT authorizer aprovar o token de alguém. */
const comToken = (sub: string, pathParameters?: Record<string, string>) => ({
  pathParameters,
  requestContext: { authorizer: { jwt: { claims: { sub } } } },
});
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
    if (comando.tipo === 'query') {
      // imita o GSI1: filtra pelo cliente e ordena pela data (ScanIndexForward)
      const itens = [...tabela.values()].filter((i) => i.GSI1PK === comando.ExpressionAttributeValues[':cliente']);
      itens.sort((a, b) => a.GSI1SK.localeCompare(b.GSI1SK) * (comando.ScanIndexForward === false ? -1 : 1));
      return { Items: itens.slice(0, comando.Limit) };
    }
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
    expect(tabela.get(`PEDIDO#${ID}|META`)).toMatchObject({
      pedidoId: ID,
      status: 'CONFIRMADO',
      total: 79.9,
      GSI1PK: 'CLIENTE#sub-ana', // índice por cliente, para a lista "meus pedidos"
      GSI1SK: '2026-11-27T12:00:00Z',
    });
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
  const OUTRO = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const gravar = (p: any) =>
    tabela.set(`PEDIDO#${p.pedidoId}|META`, {
      PK: `PEDIDO#${p.pedidoId}`, SK: 'META', GSI1PK: `CLIENTE#${p.cliente.id}`, GSI1SK: p.criadoEm, ...p, status: 'CONFIRMADO',
    });

  test('devolve o pedido ao dono, sem as chaves do banco', async () => {
    gravar(pedido());
    const resposta = await consulta.handler(comToken('sub-ana', { pedidoId: ID }));

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo).toMatchObject({ pedidoId: ID, status: 'CONFIRMADO' });
    expect(Object.keys(corpo)).not.toEqual(expect.arrayContaining(['PK', 'SK', 'GSI1PK', 'GSI1SK']));
  });

  test('o pedido de outra pessoa responde 404, como se não existisse', async () => {
    gravar(pedido());
    expect((await consulta.handler(comToken('sub-bruno', { pedidoId: ID }))).statusCode).toBe(404);
  });

  test('responde 404 enquanto o pedido ainda não foi processado', async () => {
    expect((await consulta.handler(comToken('sub-ana', { pedidoId: ID }))).statusCode).toBe(404);
  });

  test('responde 400 para um número que não é UUID, sem ir ao banco', async () => {
    expect((await consulta.handler(comToken('sub-ana', { pedidoId: '../../etc' }))).statusCode).toBe(400);
    expect(enviar).not.toHaveBeenCalled();
  });

  test('a lista traz só os pedidos do cliente logado, do mais novo ao mais antigo', async () => {
    gravar(pedido(ID, 'sub-ana', '2026-11-27T10:00:00Z'));
    gravar(pedido(OUTRO, 'sub-ana', '2026-11-27T15:00:00Z'));
    gravar(pedido('11111111-2222-4333-8444-555555555555', 'sub-bruno', '2026-11-27T12:00:00Z'));

    const resposta = await consulta.handler(comToken('sub-ana'));

    expect(resposta.statusCode).toBe(200);
    expect(JSON.parse(resposta.body).map((p: any) => p.pedidoId)).toEqual([OUTRO, ID]);
  });

  test('sem token, responde 401', async () => {
    expect((await consulta.handler({ pathParameters: { pedidoId: ID } })).statusCode).toBe(401);
    expect((await consulta.handler({})).statusCode).toBe(401);
  });
});
