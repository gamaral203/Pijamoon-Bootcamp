"use strict";
/**
 * carrinho.ts — lógica da página do carrinho (carrinho/index.html).
 *
 * O carrinho em si (obterCarrinho/salvarCarrinho, em shared.ts) já existe
 * antes desta página rodar — ela só é responsável por MOSTRAR o que está
 * salvo no localStorage, e por deixar mudar quantidade/remover item. Quem
 * primeiro coloca item no carrinho é a página de produto (ts/produto.ts).
 */
(function () {
    // RAIZ = como voltar da pasta carrinho/ até a raiz do site
    const RAIZ = "../";
    const carrinhoVazio = document.getElementById("carrinhoVazio");
    const carrinhoConteudo = document.getElementById("carrinhoConteudo");
    const carrinhoLista = document.getElementById("carrinhoLista");
    const carrinhoTotal = document.getElementById("carrinhoTotal");
    const avisoLogin = document.getElementById("avisoLogin");
    const botaoFinalizar = document.getElementById("botaoFinalizar");
    const iconeRemover = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  `;
    // catálogo completo, carregado uma vez em iniciarCarrinho() — o carrinho
    // salvo só guarda {produtoId, tamanho, quantidade}; pra mostrar nome, foto
    // e preço de cada item, precisa cruzar com o catálogo
    let catalogo = [];
    /** Some/soma uma unidade de um item; se a quantidade chegar a 0, remove a linha inteira. */
    function mudarQuantidade(produtoId, tamanho, delta) {
        const itens = obterCarrinho();
        const item = itens.find((i) => i.produtoId === produtoId && i.tamanho === tamanho);
        if (!item)
            return;
        item.quantidade += delta;
        const novaLista = item.quantidade <= 0
            ? itens.filter((i) => i !== item)
            : itens;
        salvarCarrinho(novaLista);
        renderizarCarrinho(); // redesenha tudo (linhas, total, etc.) com o carrinho atualizado
    }
    function removerItem(produtoId, tamanho) {
        const itens = obterCarrinho().filter((i) => !(i.produtoId === produtoId && i.tamanho === tamanho));
        salvarCarrinho(itens);
        renderizarCarrinho();
    }
    /**
     * Um único listener no container da lista (delegação de evento) em vez de
     * um por botão de cada linha: as linhas são recriadas toda vez que
     * renderizarCarrinho roda, então conectar eventos individualmente exigiria
     * reconectar tudo de novo a cada redesenho. Aqui, o clique "borbulha" até
     * o container, e closest() descobre em qual linha e em qual botão
     * aconteceu o clique.
     */
    carrinhoLista.addEventListener("click", (evento) => {
        const alvo = evento.target;
        const linha = alvo.closest(".carrinho-item");
        if (!linha)
            return;
        const produtoId = linha.dataset.id;
        const tamanho = linha.dataset.tamanho;
        if (alvo.closest(".btn-qtd-mais"))
            mudarQuantidade(produtoId, tamanho, 1);
        if (alvo.closest(".btn-qtd-menos"))
            mudarQuantidade(produtoId, tamanho, -1);
        if (alvo.closest(".carrinho-item-remover"))
            removerItem(produtoId, tamanho);
    });
    /**
     * Redesenha a página inteira a partir do que está salvo no carrinho: se
     * estiver vazio, mostra a mensagem de "carrinho vazio"; senão, monta uma
     * linha por item (foto, nome, tamanho, quantidade, subtotal, botão de
     * remover) e soma o total geral.
     */
    function renderizarCarrinho() {
        const itens = obterCarrinho();
        if (itens.length === 0) {
            carrinhoVazio.hidden = false;
            carrinhoConteudo.hidden = true;
            atualizarHeaderConta(RAIZ);
            return;
        }
        carrinhoVazio.hidden = true;
        carrinhoConteudo.hidden = false;
        let total = 0;
        carrinhoLista.innerHTML = itens
            .map((item) => {
            const produto = catalogo.find((p) => p.id === item.produtoId);
            if (!produto)
                return ""; // defensivo: produto pode ter sumido do catálogo
            const subtotal = produto.preco * item.quantidade;
            total += subtotal;
            return `
          <div class="carrinho-item" data-id="${produto.id}" data-tamanho="${item.tamanho}">
            <a href="${RAIZ}produto/index.html?id=${encodeURIComponent(produto.id)}" class="carrinho-item-imagem">
              <img src="${RAIZ}${produto.imagem}" alt="${produto.nome}">
            </a>
            <div class="carrinho-item-info">
              <a href="${RAIZ}produto/index.html?id=${encodeURIComponent(produto.id)}" class="carrinho-item-nome">${produto.nome}</a>
              <span class="carrinho-item-tamanho">Tamanho: ${item.tamanho}</span>
              <span class="carrinho-item-preco-unit">${formatarPreco(produto.preco)} cada</span>
            </div>
            <div class="produto-quantidade carrinho-item-qtd">
              <button type="button" class="btn-qtd-menos" aria-label="Diminuir quantidade">&minus;</button>
              <span>${item.quantidade}</span>
              <button type="button" class="btn-qtd-mais" aria-label="Aumentar quantidade">+</button>
            </div>
            <div class="carrinho-item-acoes">
              <strong class="carrinho-item-subtotal">${formatarPreco(subtotal)}</strong>
              <button type="button" class="carrinho-item-remover" aria-label="Remover item">${iconeRemover}</button>
            </div>
          </div>
        `;
        })
            .join("");
        carrinhoTotal.textContent = formatarPreco(total);
        // avisoLogin (banner "você precisa entrar pra finalizar") só aparece se ninguém estiver logado
        avisoLogin.hidden = Boolean(obterUsuario());
        atualizarHeaderConta(RAIZ);
    }
    /**
     * "Finalizar compra": aqui mora a regra que Gabriel pediu — é preciso
     * estar logado. Sem login, manda pra tela de login com
     * "?next=checkout/index.html", pra voltar direto pro checkout depois de
     * entrar. Com login, segue pro checkout (endereço + pagamento) — o
     * carrinho só é de fato esvaziado lá, quando o pagamento simulado é
     * "confirmado" (ver ts/checkout.ts).
     */
    function finalizarCompra() {
        if (!obterUsuario()) {
            window.location.href = `${RAIZ}login/index.html?next=checkout/index.html`;
            return;
        }
        window.location.href = `${RAIZ}checkout/index.html`;
    }
    botaoFinalizar.addEventListener("click", finalizarCompra);
    /** Ponto de entrada: sincroniza o cabeçalho, carrega o catálogo (pra cruzar com o carrinho salvo) e desenha a página. */
    async function iniciarCarrinho() {
        atualizarHeaderConta(RAIZ);
        catalogo = await carregarProdutos();
        renderizarCarrinho();
    }
    iniciarCarrinho();
})();
//# sourceMappingURL=carrinho.js.map