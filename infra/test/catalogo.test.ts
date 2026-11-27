// Testa a Lambda do catálogo sem AWS: o cliente do DynamoDB é trocado por
// um falso, que conta quantas vezes foi chamado.
const enviar = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn() }), { virtual: true });
jest.mock(
  '@aws-sdk/lib-dynamodb',
  () => ({
    DynamoDBDocumentClient: { from: () => ({ send: enviar }) },
    QueryCommand: jest.fn((entrada) => entrada),
  }),
  { virtual: true },
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('../../backend/catalogo/index.mjs');

beforeEach(() => {
  enviar.mockReset();
  enviar.mockResolvedValue({
    Items: [{ PK: 'PRODUCT#a', SK: 'META', GSI1PK: 'CATALOG', GSI1SK: 'PRODUCT#a', id: 'a', nome: 'Pijama A' }],
  });
});

test('devolve os produtos sem as chaves do banco e com cache no navegador', async () => {
  jest.useFakeTimers({ now: 0 });
  const resposta = await handler();

  expect(resposta.statusCode).toBe(200);
  expect(JSON.parse(resposta.body)).toEqual([{ id: 'a', nome: 'Pijama A' }]);
  expect(resposta.headers['cache-control']).toBe('public, max-age=60');
  expect(resposta.headers['x-cache-lambda']).toBe('MISS');
});

test('reaproveita o catálogo da memória por 60 s e depois busca de novo', async () => {
  jest.useFakeTimers({ now: 1_000_000 }); // começa com o cache do teste anterior vencido

  expect((await handler()).headers['x-cache-lambda']).toBe('MISS');
  jest.setSystemTime(1_000_000 + 30_000);
  expect((await handler()).headers['x-cache-lambda']).toBe('HIT');
  expect(enviar).toHaveBeenCalledTimes(1);

  jest.setSystemTime(1_000_000 + 61_000);
  expect((await handler()).headers['x-cache-lambda']).toBe('MISS');
  expect(enviar).toHaveBeenCalledTimes(2);
});

afterAll(() => jest.useRealTimers());
