/**
 * auth.ts — conversa com o Amazon Cognito (cadastro, confirmação e login).
 *
 * Sem biblioteca: a API do Cognito é um endpoint HTTPS que recebe JSON. Cada
 * ação é um POST com o cabeçalho "X-Amz-Target" dizendo qual operação é
 * (SignUp, ConfirmSignUp, InitiateAuth...). As operações de cadastro e login
 * são "públicas": só pedem o id do app client, que não é segredo.
 *
 * A senha vai do navegador direto para o Cognito, por HTTPS. Ela nunca passa
 * pela API da loja nem pelas Lambdas.
 *
 * A configuração (região e id do app client) vem do js/config.js, gerado
 * pelo CDK no deploy: muda a cada conta, então não fica fixa no código.
 */

interface ConfigPijamoon {
  regiao: string;
  idClienteCognito: string;
}

/** Erro devolvido pelo Cognito, com o tipo (ex.: "UsernameExistsException"). */
class ErroCognito extends Error {
  constructor(public readonly tipo: string, mensagem: string) {
    super(mensagem);
  }
}

function configPijamoon(): ConfigPijamoon {
  const config = (window as unknown as { PIJAMOON_CONFIG?: ConfigPijamoon }).PIJAMOON_CONFIG;
  if (!config) throw new ErroCognito("SemConfig", "js/config.js não carregou");
  return config;
}

/** Chama uma operação da API do Cognito e devolve o JSON da resposta. */
async function chamarCognito(operacao: string, corpo: Record<string, unknown>): Promise<any> {
  const { regiao, idClienteCognito } = configPijamoon();
  const resposta = await fetch(`https://cognito-idp.${regiao}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${operacao}`,
    },
    body: JSON.stringify({ ClientId: idClienteCognito, ...corpo }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // o tipo vem como "com.amazonaws...#UsernameExistsException" ou só o nome
    const tipo = String(dados.__type ?? "Desconhecido").split("#").pop() ?? "Desconhecido";
    throw new ErroCognito(tipo, dados.message ?? "Erro no Cognito");
  }
  return dados;
}

/** Cria a conta. O Cognito manda um código de confirmação para o e-mail. */
async function cadastrar(nome: string, email: string, senha: string): Promise<void> {
  await chamarCognito("SignUp", {
    Username: email,
    Password: senha,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: nome },
    ],
  });
}

/** Confirma a conta com o código de 6 dígitos que chegou por e-mail. */
async function confirmarCadastro(email: string, codigo: string): Promise<void> {
  await chamarCognito("ConfirmSignUp", { Username: email, ConfirmationCode: codigo });
}

/** Manda um código de confirmação novo. */
async function reenviarCodigo(email: string): Promise<void> {
  await chamarCognito("ResendConfirmationCode", { Username: email });
}

/** Faz o login e guarda os tokens no navegador. */
async function entrar(email: string, senha: string): Promise<void> {
  const { AuthenticationResult } = await chamarCognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: senha },
  });
  salvarSessao({ idToken: AuthenticationResult.IdToken, refreshToken: AuthenticationResult.RefreshToken });
  // o carrinho montado antes do login se junta ao salvo no servidor (ts/carrinho-sync.ts)
  localStorage.setItem("pijamoon_mesclar_carrinho", "1");
}

/**
 * Devolve um ID token que ainda vale por pelo menos 1 minuto, para mandar à
 * API. Se o atual venceu, pede um novo ao Cognito com o refresh token, sem
 * pedir a senha de novo. Se nem isso der (ex.: refresh token vencido), a
 * sessão acabou: desloga e devolve null.
 */
async function obterTokenValido(): Promise<string | null> {
  const sessao = obterSessao();
  if (!sessao) return null;

  const expiraEm = Number(lerClaimsDoToken(sessao.idToken)?.exp ?? 0) * 1000;
  if (expiraEm - Date.now() > 60_000) return sessao.idToken;

  try {
    const { AuthenticationResult } = await chamarCognito("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: sessao.refreshToken },
    });
    salvarSessao({ idToken: AuthenticationResult.IdToken, refreshToken: sessao.refreshToken });
    return AuthenticationResult.IdToken;
  } catch {
    sairUsuario();
    return null;
  }
}

/** Traduz os erros do Cognito para mensagens que o cliente entende. */
function mensagemDoErro(erro: unknown): string {
  if (!(erro instanceof ErroCognito)) return "Sem conexão com a loja. Confira sua internet e tente de novo.";
  switch (erro.tipo) {
    case "UsernameExistsException":
      return "Já existe uma conta com este e-mail. Tente entrar.";
    case "InvalidPasswordException":
      return "A senha precisa ter pelo menos 8 caracteres, com letras minúsculas e números.";
    case "InvalidParameterException":
      return "Confira os dados: o e-mail precisa ser válido e o nome não pode ficar vazio.";
    case "CodeMismatchException":
      return "Código incorreto. Confira o e-mail e tente de novo.";
    case "ExpiredCodeException":
      return "Este código venceu. Peça um novo.";
    case "NotAuthorizedException":
      return "E-mail ou senha incorretos.";
    case "UserNotConfirmedException":
      return "Falta confirmar o seu e-mail. Digite o código que enviamos.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Muitas tentativas. Espere alguns minutos e tente de novo.";
    case "SemConfig":
      return "O login não está disponível neste ambiente (falta o js/config.js).";
    default:
      return "Não foi possível concluir agora. Tente de novo em instantes.";
  }
}
