"use strict";
(function () {
    const RAIZ = "../";
    const formLogin = document.getElementById("formLogin");
    const campoNome = document.getElementById("campoNome");
    const campoEmail = document.getElementById("campoEmail");
    const avisoJaLogado = document.getElementById("avisoJaLogado");
    function proximaPagina() {
        const parametros = new URLSearchParams(window.location.search);
        const next = parametros.get("next");
        return RAIZ + (next || "index.html");
    }
    function mostrarAvisoSeJaLogado() {
        const usuario = obterUsuario();
        if (!usuario)
            return;
        avisoJaLogado.textContent = `Você já está logado como ${usuario.nome}. Pode entrar com outra conta abaixo, ou `;
        const link = document.createElement("a");
        link.href = proximaPagina();
        link.textContent = "continuar de onde parou";
        avisoJaLogado.appendChild(link);
        avisoJaLogado.append(".");
        avisoJaLogado.hidden = false;
    }
    formLogin.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const nome = campoNome.value.trim();
        const email = campoEmail.value.trim();
        if (!nome || !email)
            return;
        salvarUsuario({ nome, email });
        window.location.href = proximaPagina();
    });
    atualizarHeaderConta(RAIZ);
    mostrarAvisoSeJaLogado();
})();
//# sourceMappingURL=login.js.map