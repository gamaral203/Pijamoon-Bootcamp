// Testa a Lambda do disjuntor sem AWS: o cliente do Amplify é trocado por
// um falso, que guarda o que a função pediu.
const enviar = jest.fn();

jest.mock(
  '@aws-sdk/client-amplify',
  () => ({
    AmplifyClient: jest.fn(() => ({ send: enviar })),
    UpdateBranchCommand: jest.fn((entrada) => entrada),
  }),
  { virtual: true },
);

process.env.APP_ID = 'app123';
process.env.BRANCH_NAME = 'main';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('../../backend/disjuntor/index.mjs');

const mensagemSns = (estado: string) => ({
  Records: [{ Sns: { Message: JSON.stringify({ AlarmName: 'AlarmeTrafegoSite', NewStateValue: estado }) } }],
});

beforeEach(() => enviar.mockReset());

test('quando o alarme dispara, liga uma senha aleatória e tira o site do ar', async () => {
  expect(await handler(mensagemSns('ALARM'))).toEqual({ desarmado: true });

  expect(enviar).toHaveBeenCalledTimes(1);
  const pedido = enviar.mock.calls[0][0];
  expect(pedido).toMatchObject({ appId: 'app123', branchName: 'main', enableBasicAuth: true });

  const [usuario, senha] = Buffer.from(pedido.basicAuthCredentials, 'base64').toString().split(':');
  expect(usuario).toBe('bloqueado');
  expect(senha).toMatch(/^[0-9a-f]{48}$/);
});

test('quando o alarme volta ao normal, não faz nada', async () => {
  expect(await handler(mensagemSns('OK'))).toEqual({ desarmado: false });
  expect(enviar).not.toHaveBeenCalled();
});

test('ignora mensagens que não são de alarme', async () => {
  expect(await handler({ Records: [{ Sns: { Message: 'texto qualquer' } }] })).toEqual({ desarmado: false });
  expect(enviar).not.toHaveBeenCalled();
});
