import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';

// Lambda do carrinho sem AWS: o DynamoDB é um falso em memória.
const tabela = new Map<string, any>();
const enviar = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn() }), { virtual: true });
jest.mock(
  '@aws-sdk/lib-dynamodb',
  () => ({
    DynamoDBDocumentClient: { from: () => ({ send: enviar }) },
    GetCommand: jest.fn((e) => ({ tipo: 'get', ...e })),
    PutCommand: jest.fn((e) => ({ tipo: 'put', ...e })),
  }),
  { virtual: true },
);

process.env.TABELA_CARRINHOS = 'carrinhos';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler, validarItens, LIMITES } = require('../../backend/carrinho/index.mjs');

const evento = (metodo: string, sub: string | null, corpo?: unknown) => ({
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
  requestContext: { http: { method: metodo }, ...(sub && { authorizer: { jwt: { claims: { sub } } } }) },
});
const ITEM = { produtoId: 'camisola-limonada', tamanho: 'M', quantidade: 2 };

beforeEach(() => {
  tabela.clear();
  enviar.mockReset().mockImplementation(async (c: any) => {
    const k = `${c.Key?.PK ?? c.Item?.PK}|${c.Key?.SK ?? c.Item?.SK}`;
    if (c.tipo === 'get') return { Item: tabela.get(k) };
    tabela.set(k, c.Item);
    return {};
  });
});

describe('Lambda do carrinho', () => {
  test('grava e lê o carrinho do dono do token', async () => {
    expect((await handler(evento('PUT', 'sub-ana', { itens: [ITEM] }))).statusCode).toBe(200);
    const lido = await handler(evento('GET', 'sub-ana'));
    expect(JSON.parse(lido.body).itens).toEqual([ITEM]);
  });

  test('cada cliente vê só o próprio carrinho', async () => {
    await handler(evento('PUT', 'sub-ana', { itens: [ITEM] }));
    expect(JSON.parse((await handler(evento('GET', 'sub-bruno'))).body).itens).toEqual([]);
  });

  test('o carrinho expira sozinho (TTL) e só guarda os campos conhecidos', async () => {
    await handler(evento('PUT', 'sub-ana', { itens: [{ ...ITEM, preco: 0.01, extra: '<script>' }] }));
    const gravado = tabela.get('CLIENTE#sub-ana|CARRINHO');
    expect(gravado.itens).toEqual([ITEM]);
    expect(gravado.expiraEm).toBeGreaterThan(Date.now() / 1000);
  });

  test.each([
    ['lista grande demais', { itens: Array.from({ length: LIMITES.itens + 1 }, () => ITEM) }],
    ['quantidade zero', { itens: [{ ...ITEM, quantidade: 0 }] }],
    ['quantidade quebrada', { itens: [{ ...ITEM, quantidade: 1.5 }] }],
    ['sem tamanho', { itens: [{ produtoId: 'x', quantidade: 1 }] }],
    ['itens não é lista', { itens: 'tudo' }],
  ])('recusa %s com 400', async (_nome, corpo) => {
    expect((await handler(evento('PUT', 'sub-ana', corpo))).statusCode).toBe(400);
    expect(tabela.size).toBe(0);
  });

  test('sem token, 401', async () => {
    expect((await handler(evento('GET', null))).statusCode).toBe(401);
  });

  test('carrinho vazio é válido (depois da compra)', () => {
    expect(validarItens([])).toEqual({ itens: [] });
  });
});

describe('infra do carrinho', () => {
  const template = Template.fromStack(new PijamoonStack(new cdk.App(), 'TesteCarrinho'));

  test('GET e PUT /api/cart exigem login', () => {
    for (const rota of ['GET /api/cart', 'PUT /api/cart']) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: rota, AuthorizationType: 'JWT' });
    }
  });

  test('a tabela de carrinhos tem TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      TimeToLiveSpecification: { AttributeName: 'expiraEm', Enabled: true },
      KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' }],
    });
  });
});
