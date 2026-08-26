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
        }
        else {
            botaoConta.title = "Entrar";
            botaoConta.setAttribute("aria-label", "Entrar");
            botaoConta.classList.remove("logado");
            botaoConta.onclick = () => {
                window.location.href = `${raiz}login/index.html`;
            };
        }
    }
    if (badgeCarrinho) {
        const total = contarItensCarrinho();
        badgeCarrinho.textContent = String(total);
        badgeCarrinho.hidden = total === 0;
    }
}
//# sourceMappingURL=shared.js.map