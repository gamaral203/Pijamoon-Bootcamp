(function () {
  const RAIZ = "../";

  const formLogin = document.getElementById("formLogin") as HTMLFormElement;
  const campoNome = document.getElementById("campoNome") as HTMLInputElement;
  const campoEmail = document.getElementById("campoEmail") as HTMLInputElement;
  const avisoJaLogado = document.getElementById("avisoJaLogado") as HTMLParagraphElement;

  function proximaPagina(): string {
    const parametros = new URLSearchParams(window.location.search);
    const next = parametros.get("next");
    return RAIZ + (next || "index.html");
  }

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

  formLogin.addEventListener("submit", (evento: SubmitEvent) => {
    evento.preventDefault();

    const nome = campoNome.value.trim();
    const email = campoEmail.value.trim();
    if (!nome || !email) return;

    salvarUsuario({ nome, email });
    window.location.href = proximaPagina();
  });

  atualizarHeaderConta(RAIZ);
  mostrarAvisoSeJaLogado();
})();
