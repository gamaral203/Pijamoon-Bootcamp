"use strict";
async function carregarProdutos(caminho = "data/products.json") {
    const resposta = await fetch(caminho);
    if (!resposta.ok) {
        throw new Error(`Falha ao carregar catálogo: ${resposta.status}`);
    }
    return resposta.json();
}
function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
const CHAVE_USUARIO = "pijamoon_usuario";
const CHAVE_CARRINHO = "pijamoon_carrinho";
function obterUsuario() {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    if (!bruto)
        return null;
    try {
        return JSON.parse(bruto);
    }
    catch {
        return null;
    }
}
function salvarUsuario(usuario) {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}
function sairUsuario() {
    localStorage.removeItem(CHAVE_USUARIO);
}
function obterCarrinho() {
    const bruto = localStorage.getItem(CHAVE_CARRINHO);
    if (!bruto)
        return [];
    try {
        return JSON.parse(bruto);
    }
    catch {
        return [];
    }
}
function salvarCarrinho(itens) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
}
function adicionarAoCarrinho(produtoId, tamanho, quantidade) {
    const itens = obterCarrinho();
    const existente = itens.find((item) => item.produtoId === produtoId && item.tamanho === tamanho);
    if (existente) {
        existente.quantidade += quantidade;
    }
    else {
        itens.push({ produtoId, tamanho, quantidade });
    }
    salvarCarrinho(itens);
}
function contarItensCarrinho() {
    return obterCarrinho().reduce((total, item) => total + item.quantidade, 0);
}
/**
 * Atualiza o ícone de conta (entrar/sair) e o número no ícone de carrinho
 * do cabeçalho. Chamada em toda página que tem esses elementos.
 * "raiz" é o prefixo relativo pra voltar até a raiz do site
 * (vazio na home, "../" nas páginas de um nível abaixo).
 */
function atualizarHeaderConta(raiz = "") {
    const botaoConta = document.getElementById("botaoConta");
    const contaNome = document.getElementById("contaNome");
    const badgeCarrinho = document.getElementById("badgeCarrinho");
    if (botaoConta) {
        const usuario = obterUsuario();
        if (usuario) {
            const primeiroNome = usuario.nome.split(" ")[0];
            botaoConta.title = `Sair (${primeiroNome})`;
            botaoConta.setAttribute("aria-label", `Sair (${primeiroNome})`);
            botaoConta.classList.add("logado");
            botaoConta.onclick = () => {
                sairUsuario();
                window.location.href = `${raiz}index.html`;
            };
            if (contaNome) {
                contaNome.textContent = primeiroNome;
                contaNome.hidden = false;
            }
        }
        else {
            botaoConta.title = "Entrar";
            botaoConta.setAttribute("aria-label", "Entrar");
            botaoConta.classList.remove("logado");
            botaoConta.onclick = () => {
                window.location.href = `${raiz}login/index.html`;
            };
            if (contaNome) {
                contaNome.textContent = "";
                contaNome.hidden = true;
            }
        }
    }
    if (badgeCarrinho) {
        const total = contarItensCarrinho();
        badgeCarrinho.textContent = String(total);
        badgeCarrinho.hidden = total === 0;
    }
    atualizarBotaoTema();
}
/**
 * Modo escuro: alternável e salvo no localStorage. O <head> de cada página
 * já aplica o tema salvo antes do CSS carregar (evita o "flash" de tema
 * claro); aqui só cuidamos do botão e da troca em tempo real.
 */
const CHAVE_TEMA = "pijamoon_tema";
const ICONE_LUA = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
  </svg>
`;
const ICONE_SOL = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
`;
function temaAtual() {
    return localStorage.getItem(CHAVE_TEMA) === "escuro" ? "escuro" : "claro";
}
function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem(CHAVE_TEMA, tema);
    atualizarBotaoTema();
}
function alternarTema() {
    aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro");
}
function atualizarBotaoTema() {
    const botaoTema = document.getElementById("botaoTema");
    if (!botaoTema)
        return;
    const escuro = temaAtual() === "escuro";
    botaoTema.innerHTML = escuro ? ICONE_SOL : ICONE_LUA;
    botaoTema.title = escuro ? "Modo claro" : "Modo escuro";
    botaoTema.setAttribute("aria-label", botaoTema.title);
    botaoTema.onclick = alternarTema;
}
//# sourceMappingURL=shared.js.map