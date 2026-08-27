"use strict";
/**
 * login.ts — lógica da página de login (login/index.html).
 *
 * Não existe senha validada de verdade em lugar nenhum: preencher qualquer
 * nome e e-mail "loga" o visitante, porque este é um site estático sem
 * servidor. O objetivo aqui não é segurança de verdade — é simular o FLUXO
 * de "é preciso estar logado pra comprar" (pedido do desafio), sendo
 * honesto de que é uma simulação. Numa loja real, isso seria substituído
 * por um serviço de autenticação de verdade (ver a nota em ts/shared.ts).
 */
(function () {
    // RAIZ = como voltar da pasta login/ até a raiz do site
    const RAIZ = "../";
    const formLogin = document.getElementById("formLogin");
    const campoNome = document.getElementById("campoNome");
    const campoEmail = document.getElementById("campoEmail");
    const avisoJaLogado = document.getElementById("avisoJaLogado");
    /**
     * Depois de logar, pra onde a pessoa deve ir? Se ela veio de "finalizar
     * compra" no carrinho ou no checkout, a URL de login tem
     * "?next=carrinho/index.html" (ou "?next=checkout/index.html") — assim
     * ela volta pra terminar o que estava fazendo, em vez de cair na home e
     * ter que navegar tudo de novo. Sem o parâmetro, o padrão é a home.
     */
    function proximaPagina() {
        const parametros = new URLSearchParams(window.location.search);
        const next = parametros.get("next");
        return RAIZ + (next || "index.html");
    }
    /** Se já tiver alguém logado, avisa (em vez de simplesmente deixar preencher o formulário de novo sem explicação). */
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
        evento.preventDefault(); // não deixa o navegador recarregar a página (comportamento padrão de <form>)
        const nome = campoNome.value.trim();
        const email = campoEmail.value.trim();
        if (!nome || !email)
            return; // required já bloqueia isso, é só uma segunda checagem
        salvarUsuario({ nome, email });
        window.location.href = proximaPagina();
    });
    atualizarHeaderConta(RAIZ);
    mostrarAvisoSeJaLogado();
})();
//# sourceMappingURL=login.js.map