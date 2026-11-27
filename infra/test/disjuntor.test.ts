// Testa a Lambda do disjuntor sem AWS: o cliente do CloudFront é trocado por
// um falso, que guarda a configuração da distribuição em memória.
const enviar = jest.fn();
let configuracao: any;

jest.mock(
  '@aws-sdk/client-cloudfront',
  () => ({
    CloudFrontClient: jest.fn(() => ({ send: enviar })),
    GetDistributionConfigCommand: jest.fn((entrada) => ({ tipo: 'get', ...entrada })),
    UpdateDistributionCommand: jest.fn((entrada) => ({ tipo: 'update', ...entrada })),
  }),
  { virtual: true },
);

process.env.ID_DISTRIBUICAO = 'E123ABC';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('../../backend/disjuntor/index.mjs');

const mensagemSns = (estado: string) => ({
  Records: [{ Sns: { Message: JSON.stringify({ AlarmName: 'AlarmeTrafegoSite', NewStateValue: estado }) } }],
});

beforeEach(() => {
  configuracao = { Enabled: true, Comment: 'Pijamoon: site e API', Origins: { Quantity: 2 } };
  enviar.mockReset().mockImplementation(async (comando: any) => {
    if (comando.tipo === 'get') return { DistributionConfig: { ...configuracao }, ETag: 'ETAG-1' };
    if (comando.IfMatch !== 'ETAG-1') throw new Error('PreconditionFailed');
    configuracao = comando.DistributionConfig;
    return {};
  });
});

test('quando o alarme dispara, desliga a distribuição sem mexer no resto da configuração', async () => {
  expect(await handler(mensagemSns('ALARM'))).toEqual({ desarmado: true, resultado: 'desligada' });

  const atualizacao = enviar.mock.calls.find(([c]) => c.tipo === 'update')[0];
  expect(atualizacao).toMatchObject({ Id: 'E123ABC', IfMatch: 'ETAG-1' });
  expect(configuracao).toEqual({ Enabled: false, Comment: 'Pijamoon: site e API', Origins: { Quantity: 2 } });
});

test('se já estiver desligada, não atualiza de novo', async () => {
  configuracao.Enabled = false;
  expect(await handler(mensagemSns('ALARM'))).toEqual({ desarmado: true, resultado: 'sem mudança' });
  expect(enviar.mock.calls.some(([c]) => c.tipo === 'update')).toBe(false);
});

test('quando o alarme volta ao normal, não faz nada', async () => {
  expect(await handler(mensagemSns('OK'))).toEqual({ desarmado: false });
  expect(enviar).not.toHaveBeenCalled();
});

test('ignora mensagens que não são de alarme', async () => {
  expect(await handler({ Records: [{ Sns: { Message: 'texto qualquer' } }] })).toEqual({ desarmado: false });
  expect(enviar).not.toHaveBeenCalled();
});

test('religa à mão com {"acao": "religar"}', async () => {
  configuracao.Enabled = false;
  expect(await handler({ acao: 'religar' })).toEqual({ religado: true, resultado: 'religada' });
  expect(configuracao.Enabled).toBe(true);
});
