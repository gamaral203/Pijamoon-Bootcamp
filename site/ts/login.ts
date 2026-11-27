/**
 * login.ts — lógica da página de login (login/index.html).
 *
 * Três telas no mesmo lugar, todas falando com o Amazon Cognito (ts/auth.ts):
 *   Entrar           → InitiateAuth (e-mail e senha) e guarda os tokens
 *   Criar conta      → SignUp; o Cognito manda um código para o e-mail
 *   Confirmar e-mail → ConfirmSignUp com o código, e já entra na conta
 */
(function () {
  // RAIZ = como voltar da pasta login/ até a raiz do site
  const RAIZ = "../";

  const abaEntrar = document.getElementById("abaEntrar") as HTMLButtonElement;
  const abaCadastro = document.getElementById("abaCadastro") as HTMLButtonElement;
  const formEntrar = document.getElementById("formEntrar") as HTMLFormElement;
  const formCadastro = document.getElementById("formCadastro") as HTMLFormElement;
  const formConfirmar = document.getElementById("formConfirmar") as HTMLFormElement;
  const mensagem = document.getElementById("loginMensagem") as HTMLParagraphElement;
  const avisoJaLogado = document.getElementById("avisoJaLogado") as HTMLParagraphElement;
  const confirmarTexto = document.getElementById("confirmarTexto") as HTMLParagraphElement;
  const botaoReenviar = document.getElementById("botaoReenviar") as HTMLButtonElement;

  const campo = (id: string) => document.getElementById(id) as HTMLInputElement;

  /**
   * Guarda e-mail e senha entre o cadastro e a confirmação: depois que o
   * código é confirmado, a pessoa já entra na conta sem digitar tudo de novo.
   * Fica só na memória desta página (nunca no localStorage).
   */
  let pendente: { email: string; senha: string } | null = null;

  /**
   * Depois de logar, pra onde a pessoa deve ir? Se ela veio de "finalizar
   * compra" no carrinho ou no checkout, a URL de login tem
   * "?next=checkout/index.html" — assim ela volta pra terminar o que estava
   * fazendo. Só aceita caminhos internos do site (nada de "https://..." ou
   * "//outro-site"), para o link de login não virar um redirecionamento
   * para fora.
   */
  function proximaPagina(): string {
    const next = new URLSearchParams(window.location.search).get("next") ?? "";
    const interno = /^[a-z0-9-]+\/index\.html$/.test(next);
    return RAIZ + (interno ? next : "index.html");
  }

  type Tela = "entrar" | "cadastro" | "confirmar";

  function mostrarTela(tela: Tela): void {
    formEntrar.hidden = tela !== "entrar";
    formCadastro.hidden = tela !== "cadastro";
    formConfirmar.hidden = tela !== "confirmar";
    abaEntrar.classList.toggle("ativa", tela === "entrar");
    abaCadastro.classList.toggle("ativa", tela === "cadastro");
    abaEntrar.setAttribute("aria-selected", String(tela === "entrar"));
    abaCadastro.setAttribute("aria-selected", String(tela === "cadastro"));
    mensagem.hidden = true;
  }

  /** Mostra um aviso (erro ou sucesso). textContent: o texto nunca vira HTML. */
  function avisar(texto: string, tipo: "erro" | "sucesso" = "erro"): void {
    mensagem.textContent = texto;
    mensagem.className = `login-mensagem login-mensagem-${tipo}`;
    mensagem.hidden = false;
  }

  /** Desabilita o botão do formulário enquanto espera o Cognito responder. */
  async function enquantoEnvia(form: HTMLFormElement, texto: string, acao: () => Promise<void>): Promise<void> {
    const botao = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = texto;
    try {
      await acao();
    } finally {
      botao.disabled = false;
      botao.textContent = original;
    }
  }

  function irParaConfirmacao(email: string, senha: string): void {
    pendente = { email, senha };
    confirmarTexto.textContent = `Enviamos um código de 6 dígitos para ${email}. Ele pode levar um minutinho para chegar (confira o spam).`;
    mostrarTela("confirmar");
    campo("confirmarCodigo").focus();
  }

  abaEntrar.addEventListener("click", () => mostrarTela("entrar"));
  abaCadastro.addEventListener("click", () => mostrarTela("cadastro"));

  formEntrar.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const email = campo("entrarEmail").value.trim();
    const senha = campo("entrarSenha").value;
    enquantoEnvia(formEntrar, "Entrando…", async () => {
      try {
        await entrar(email, senha);
        window.location.href = proximaPagina();
      } catch (erro) {
        // conta criada mas não confirmada: leva direto para digitar o código
        if (erro instanceof ErroCognito && erro.tipo === "UserNotConfirmedException") {
          irParaConfirmacao(email, senha);
          avisar(mensagemDoErro(erro));
          return;
        }
        avisar(mensagemDoErro(erro));
      }
    });
  });

  formCadastro.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const nome = campo("cadastroNome").value.trim();
    const email = campo("cadastroEmail").value.trim();
    const senha = campo("cadastroSenha").value;
    enquantoEnvia(formCadastro, "Criando conta…", async () => {
      try {
        await cadastrar(nome, email, senha);
        irParaConfirmacao(email, senha);
      } catch (erro) {
        avisar(mensagemDoErro(erro));
      }
    });
  });

  formConfirmar.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!pendente) return mostrarTela("entrar");
    const { email, senha } = pendente;
    const codigo = campo("confirmarCodigo").value.trim();
    enquantoEnvia(formConfirmar, "Confirmando…", async () => {
      try {
        await confirmarCadastro(email, codigo);
        await entrar(email, senha);
        pendente = null;
        window.location.href = proximaPagina();
      } catch (erro) {
        avisar(mensagemDoErro(erro));
      }
    });
  });

  botaoReenviar.addEventListener("click", async () => {
    if (!pendente) return;
    botaoReenviar.disabled = true;
    try {
      await reenviarCodigo(pendente.email);
      avisar("Código reenviado. Confira o seu e-mail.", "sucesso");
    } catch (erro) {
      avisar(mensagemDoErro(erro));
    } finally {
      // espera 30 s antes de deixar pedir outro: evita encher a caixa de e-mails
      setTimeout(() => (botaoReenviar.disabled = false), 30_000);
    }
  });

  /** Se já tiver alguém logado, avisa (em vez de mostrar o formulário sem explicação). */
  function mostrarAvisoSeJaLogado(): void {
    const usuario = obterUsuario();
    if (!usuario) return;

    avisoJaLogado.textContent = `Você já está logado como ${usuario.nome}. Pode entrar com outra conta abaixo, ou `;
    const link = document.createElement("a");
    link.href = proximaPagina();
    link.textContent = "continuar de onde parou";
    avisoJaLogado.appendChild(link);
    avisoJaLogado.append(".");
    avisoJaLogado.hidden = false;
  }

  atualizarHeaderConta(RAIZ);
  mostrarAvisoSeJaLogado();
})();
