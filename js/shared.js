"use strict";
/**
 * shared.ts — código que TODAS as páginas usam.
 *
 * Este arquivo não tem import/export porque o projeto não usa bundler nem
 * módulos: cada página HTML carrega este script ANTES do seu próprio script
 * de página (app.ts, produto.ts, login.ts, carrinho.ts, checkout.ts), via
 * duas tags <script> em sequência. Como os dois rodam no mesmo escopo global
 * do navegador, tudo que é declarado aqui (a interface Produto, as funções)
 * fica disponível pro script da página seguinte usar direto, sem precisar
 * importar nada.
 *
 * Se você abrir qualquer outro .ts e ver uma função sendo chamada sem estar
 * declarada naquele arquivo, ela provavelmente está aqui.
 */
/**
 * Busca o catálogo via fetch. "caminho" existe porque o mesmo arquivo
 * products.json é buscado de profundidades diferentes: a home busca
 * "data/products.json" (padrão), mas páginas dentro de uma subpasta (ex:
 * produto/index.html) precisam de "../data/products.json" — cada página
 * passa o caminho certo pra ela mesma.
 */
async function carregarProdutos(caminho = "data/products.json") {
    const resposta = await fetch(caminho);
    if (!resposta.ok) {
        throw new Error(`Falha ao carregar catálogo: ${resposta.status}`);
    }
    return resposta.json();
}
/** Formata um número em Real: 89.9 → "R$ 89,90". */
function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
/** Deixa a primeira letra maiúscula: "alcinha" → "Alcinha". Usado nas categorias. */
function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
/** Chaves usadas no localStorage do navegador — nomes prefixados "pijamoon_"
 *  pra não colidir com nada de outro site guardado no mesmo navegador. */
const CHAVE_USUARIO = "pijamoon_usuario";
const CHAVE_CARRINHO = "pijamoon_carrinho";
/** Lê o usuário logado do localStorage, ou null se ninguém estiver logado. */
function obterUsuario() {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    if (!bruto)
        return null;
    try {
        return JSON.parse(bruto);
    }
    catch {
        // localStorage corrompido/editado à mão — trata como "não logado" em vez de quebrar a página
        return null;
    }
}
/** Salva {nome, email} no localStorage — chamado pelo formulário de login. */
function salvarUsuario(usuario) {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}
/** Apaga o usuário salvo — "logout". */
function sairUsuario() {
    localStorage.removeItem(CHAVE_USUARIO);
}
/** Lê a lista de itens do carrinho, ou array vazio se não tiver nada salvo. */
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
/** Sobrescreve o carrinho inteiro no localStorage com a lista dada. */
function salvarCarrinho(itens) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
}
/**
 * Adiciona um produto ao carrinho. Se o mesmo produto+tamanho já estiver lá
 * (ex: usuário volta na mesma peça e clica "adicionar" de novo), soma a
 * quantidade em vez de criar uma linha duplicada.
 */
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
/** Soma a quantidade de todos os itens — é o número que aparece no badge do carrinho. */
function contarItensCarrinho() {
    return obterCarrinho().reduce((total, item) => total + item.quantidade, 0);
}
/**
 * Atualiza o ícone de conta (entrar/sair), o nome ao lado dele, o número no
 * ícone de carrinho, e o botão de tema — tudo no cabeçalho. Chamada no
 * início de toda página que tem esses elementos (ver o "iniciar"/"iniciarX"
 * de cada script de página).
 *
 * "raiz" é o prefixo relativo pra voltar até a raiz do site: vazio na home
 * (index.html), "../" nas páginas de um nível abaixo (produto/, login/,
 * carrinho/, checkout/) — é assim que um mesmo botão "Entrar" sabe navegar
 * pra "login/index.html" estando na home, ou "../login/index.html" estando
 * dentro de produto/index.html.
 */
function atualizarHeaderConta(raiz = "") {
    const botaoConta = document.getElementById("botaoConta");
    const contaNome = document.getElementById("contaNome");
    const badgeCarrinho = document.getElementById("badgeCarrinho");
    if (botaoConta) {
        const usuario = obterUsuario();
        if (usuario) {
            // logado: o botão de "entrar" vira "sair", mostra o primeiro nome,
            // e o clique passa a deslogar em vez de ir pra tela de login
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
            // deslogado: botão volta a ser "entrar" e leva pra tela de login
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
        // esconde a bolinha do badge quando o carrinho está vazio, em vez de mostrar "0"
        badgeCarrinho.hidden = total === 0;
    }
    atualizarBotaoTema();
}
/* ============================================================
 * Modo escuro
 * ============================================================
 * Alternável por um botão no cabeçalho e salvo no localStorage. O <head> de
 * cada página já aplica o tema salvo antes do CSS carregar (um scriptzinho
 * inline, pra evitar o "flash" de tema claro que trocaria pra escuro um
 * instante depois) — aqui só cuidamos do botão em si e da troca em tempo
 * real. As cores de cada tema ficam no css/style.css, em variáveis CSS que
 * mudam de valor conforme o atributo data-tema no <html>.
 * ============================================================ */
const CHAVE_TEMA = "pijamoon_tema";
/** Ícone de lua — mostrado quando o tema ATUAL é claro (clique troca pra escuro). */
const ICONE_LUA = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
  </svg>
`;
/** Ícone de sol — mostrado quando o tema ATUAL é escuro (clique troca pra claro). */
const ICONE_SOL = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
`;
/** Lê o tema salvo no localStorage ("escuro" ou "claro", padrão claro). */
function temaAtual() {
    return localStorage.getItem(CHAVE_TEMA) === "escuro" ? "escuro" : "claro";
}
/**
 * Aplica um tema: seta o atributo data-tema no <html> (é isso que o CSS lê
 * pra trocar as variáveis de cor — ver :root[data-tema="escuro"] no
 * style.css), salva a escolha, e atualiza o ícone do botão.
 */
function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem(CHAVE_TEMA, tema);
    atualizarBotaoTema();
}
/** Troca claro↔escuro. Chamada quando o usuário clica no botão de tema. */
function alternarTema() {
    aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro");
}
/** Atualiza o ícone/tooltip do botão de tema pra refletir o tema atual, e liga o clique nele. */
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