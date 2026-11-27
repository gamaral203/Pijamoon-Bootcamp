// Testa a Lambda do checkout sem AWS: DynamoDB e EventBridge são falsos.
const consultar = jest.fn();
const publicar = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn() }), { virtual: true });
jest.mock(
  '@aws-sdk/lib-dynamodb',
  () => ({ DynamoDBDocumentClient: { from: () => ({ send: consultar }) }, QueryCommand: jest.fn((e) => e) }),
  { virtual: true },
);
jest.mock(
  '@aws-sdk/client-eventbridge',
  () => ({ EventBridgeClient: jest.fn(() => ({ send: publicar })), PutEventsCommand: jest.fn((e) => e) }),
  { virtual: true },
);

process.env.TABELA_PRODUTOS = 'produtos';
process.env.NOME_BARRAMENTO = 'barramento';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler, validarPedido, clienteDoToken, LIMITES } = require('../../backend/checkout/index.mjs');

/** Um evento do API Gateway como chega depois do JWT authorizer aprovar o token. */
const comToken = (corpo: unknown, claims: Record<string, string> = { sub: 'sub-ana', email: 'Ana@Exemplo.com', name: 'Ana' }) => ({
  body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  requestContext: { authorizer: { jwt: { claims } } },
});

const CATALOGO = [
  { id: 'camisola-limonada', nome: 'Camisola Limonada', preco: 79.9, tamanhos: ['P', 'M', 'G'] },
  { id: 'pijama-estrelas', nome: 'Pijama Estrelas', preco: 129.9, tamanhos: ['M', 'G'] },
];
const produtos = new Map(CATALOGO.map((p) => [p.id, p]));

const pedidoValido = (): any => ({
  itens: [
    { produtoId: 'camisola-limonada', tamanho: 'M', quantidade: 2 },
    { produtoId: 'pijama-estrelas', tamanho: 'G', quantidade: 1 },
  ],
  entrega: { cep: '01001-000', rua: 'Praça da Sé', numero: '1', bairro: 'Sé', cidade: 'São Paulo', estado: 'SP' },
  pagamento: 'pix',
});

beforeEach(() => {
  consultar.mockReset().mockResolvedValue({ Items: CATALOGO });
  publicar.mockReset().mockResolvedValue({ FailedEntryCount: 0 });
});

describe('validarPedido', () => {
  test('usa o preço do catálogo, ignorando qualquer preço enviado pelo site', () => {
    const corpo = pedidoValido();
    corpo.itens[0].preco = 0.01;
    const { pedido, erros } = validarPedido(corpo, produtos);

    expect(erros).toBeUndefined();
    expect(pedido.itens[0]).toEqual({
      produtoId: 'camisola-limonada',
      nome: 'Camisola Limonada',
      tamanho: 'M',
      quantidade: 2,
      precoUnitario: 79.9,
      subtotal: 159.8,
    });
    expect(pedido.total).toBe(289.7);
  });

  test.each([
    ['produto inexistente', (c: any) => (c.itens[0].produtoId = 'nao-existe'), /não existe mais na loja/],
    ['tamanho que o produto não tem', (c: any) => (c.itens[1].tamanho = 'P'), /Pijama Estrelas: o tamanho "P" não está disponível/],
    ['quantidade zero', (c: any) => (c.itens[0].quantidade = 0), /Camisola Limonada: a quantidade/],
    ['quantidade quebrada', (c: any) => (c.itens[0].quantidade = 1.5), /quantidade/],
    ['quantidade acima do limite', (c: any) => (c.itens[0].quantidade = LIMITES.unidadesPorItem + 1), /quantidade/],
    ['carrinho vazio', (c: any) => (c.itens = []), /carrinho está vazio/],
    ['endereço sem cidade', (c: any) => delete c.entrega.cidade, /campo "Cidade"/],
    ['pagamento desconhecido', (c: any) => (c.pagamento = 'boleto'), /cartão ou Pix/],
  ])('recusa %s', (_nome, estragar, mensagem) => {
    const corpo = pedidoValido();
    estragar(corpo);
    const { erros } = validarPedido(corpo, produtos);
    expect(erros.join(' | ')).toMatch(mensagem);
  });
});

describe('clienteDoToken', () => {
  test('lê o id, o nome e o e-mail das claims do token', () => {
    expect(clienteDoToken(comToken({}))).toEqual({ id: 'sub-ana', nome: 'Ana', email: 'ana@exemplo.com' });
  });

  test('sem token (rota sem authorizer por engano), não há cliente', () => {
    expect(clienteDoToken({ body: '{}' })).toBeNull();
  });
});

describe('handler', () => {
  test('publica o PedidoRecebido com o cliente do token e responde 202', async () => {
    const corpo = pedidoValido();
    corpo.cliente = { nome: 'Outra Pessoa', email: 'outra@exemplo.com' }; // tentativa de se passar por outra pessoa
    const resposta = await handler(comToken(corpo));

    expect(resposta.statusCode).toBe(202);
    const recebido = JSON.parse(resposta.body);
    expect(recebido).toMatchObject({ status: 'RECEBIDO', total: 289.7 });
    expect(recebido.pedidoId).toMatch(/^[0-9a-f-]{36}$/);

    const [entrada] = publicar.mock.calls[0][0].Entries;
    expect(entrada).toMatchObject({ EventBusName: 'barramento', Source: 'pijamoon.checkout', DetailType: 'PedidoRecebido' });
    expect(JSON.parse(entrada.Detail)).toMatchObject({
      pedidoId: JSON.parse(resposta.body).pedidoId,
      total: 289.7,
      cliente: { id: 'sub-ana', nome: 'Ana', email: 'ana@exemplo.com' }, // o do token, não o do corpo
    });
  });

  test('responde 401 sem token, sem publicar nada', async () => {
    const resposta = await handler({ body: JSON.stringify(pedidoValido()) });
    expect(resposta.statusCode).toBe(401);
    expect(publicar).not.toHaveBeenCalled();
  });

  test('responde 400 com os detalhes quando o pedido é inválido, sem publicar nada', async () => {
    const corpo = pedidoValido();
    corpo.pagamento = 'boleto';
    const resposta = await handler(comToken(corpo));

    expect(resposta.statusCode).toBe(400);
    expect(JSON.parse(resposta.body).detalhes).toEqual(['Escolha cartão ou Pix como forma de pagamento.']);
    expect(publicar).not.toHaveBeenCalled();
  });

  test('responde 400 quando o corpo não é JSON', async () => {
    expect((await handler(comToken('isso não é json'))).statusCode).toBe(400);
  });

  test('responde 503 se o EventBridge recusar o evento', async () => {
    publicar.mockResolvedValue({ FailedEntryCount: 1 });
    expect((await handler(comToken(pedidoValido()))).statusCode).toBe(503);
  });
});
