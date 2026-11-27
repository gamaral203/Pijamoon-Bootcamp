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
const { handler, validarPedido, LIMITES } = require('../../backend/checkout/index.mjs');

const CATALOGO = [
  { id: 'camisola-limonada', nome: 'Camisola Limonada', preco: 79.9, tamanhos: ['P', 'M', 'G'] },
  { id: 'pijama-estrelas', nome: 'Pijama Estrelas', preco: 129.9, tamanhos: ['M', 'G'] },
];
const produtos = new Map(CATALOGO.map((p) => [p.id, p]));

const pedidoValido = (): any => ({
  cliente: { nome: 'Ana', email: 'Ana@Exemplo.com' },
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
    expect(pedido.cliente.email).toBe('ana@exemplo.com');
  });

  test.each([
    ['produto inexistente', (c: any) => (c.itens[0].produtoId = 'nao-existe'), /não existe/],
    ['tamanho que o produto não tem', (c: any) => (c.itens[1].tamanho = 'P'), /tamanho "P"/],
    ['quantidade zero', (c: any) => (c.itens[0].quantidade = 0), /quantidade/],
    ['quantidade quebrada', (c: any) => (c.itens[0].quantidade = 1.5), /quantidade/],
    ['quantidade acima do limite', (c: any) => (c.itens[0].quantidade = LIMITES.unidadesPorItem + 1), /quantidade/],
    ['carrinho vazio', (c: any) => (c.itens = []), /pelo menos um item/],
    ['e-mail inválido', (c: any) => (c.cliente.email = 'ana@'), /email/],
    ['endereço sem cidade', (c: any) => delete c.entrega.cidade, /entrega.cidade/],
    ['pagamento desconhecido', (c: any) => (c.pagamento = 'boleto'), /pagamento/],
  ])('recusa %s', (_nome, estragar, mensagem) => {
    const corpo = pedidoValido();
    estragar(corpo);
    const { erros } = validarPedido(corpo, produtos);
    expect(erros.join(' | ')).toMatch(mensagem);
  });
});

describe('handler', () => {
  test('publica o PedidoRecebido e responde 202 com o número do pedido', async () => {
    const resposta = await handler({ body: JSON.stringify(pedidoValido()) });

    expect(resposta.statusCode).toBe(202);
    const corpo = JSON.parse(resposta.body);
    expect(corpo).toMatchObject({ status: 'RECEBIDO', total: 289.7 });
    expect(corpo.pedidoId).toMatch(/^[0-9a-f-]{36}$/);

    const [entrada] = publicar.mock.calls[0][0].Entries;
    expect(entrada).toMatchObject({ EventBusName: 'barramento', Source: 'pijamoon.checkout', DetailType: 'PedidoRecebido' });
    expect(JSON.parse(entrada.Detail)).toMatchObject({ pedidoId: corpo.pedidoId, total: 289.7 });
  });

  test('responde 400 com os detalhes quando o pedido é inválido, sem publicar nada', async () => {
    const corpo = pedidoValido();
    corpo.pagamento = 'boleto';
    const resposta = await handler({ body: JSON.stringify(corpo) });

    expect(resposta.statusCode).toBe(400);
    expect(JSON.parse(resposta.body).detalhes).toEqual(['pagamento precisa ser "cartao" ou "pix"']);
    expect(publicar).not.toHaveBeenCalled();
  });

  test('responde 400 quando o corpo não é JSON', async () => {
    expect((await handler({ body: 'isso não é json' })).statusCode).toBe(400);
  });

  test('responde 503 se o EventBridge recusar o evento', async () => {
    publicar.mockResolvedValue({ FailedEntryCount: 1 });
    expect((await handler({ body: JSON.stringify(pedidoValido()) })).statusCode).toBe(503);
  });
});
