(function () {
  const RAIZ = "../";

  const carrinhoVazio = document.getElementById("carrinhoVazio") as HTMLParagraphElement;
  const carrinhoConteudo = document.getElementById("carrinhoConteudo") as HTMLDivElement;
  const carrinhoLista = document.getElementById("carrinhoLista") as HTMLDivElement;
  const carrinhoTotal = document.getElementById("carrinhoTotal") as HTMLElement;
  const avisoLogin = document.getElementById("avisoLogin") as HTMLParagraphElement;
  const botaoFinalizar = document.getElementById("botaoFinalizar") as HTMLButtonElement;

  const iconeRemover = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  `;

  let catalogo: Produto[] = [];

  function mudarQuantidade(produtoId: string, tamanho: string, delta: number): void {
    const itens = obterCarrinho();
    const item = itens.find((i) => i.produtoId === produtoId && i.tamanho === tamanho);
    if (!item) return;

    item.quantidade += delta;
    const novaLista = item.quantidade <= 0
      ? itens.filter((i) => i !== item)
      : itens;

    salvarCarrinho(novaLista);
    renderizarCarrinho();
  }

  function removerItem(produtoId: string, tamanho: string): void {
    const itens = obterCarrinho().filter((i) => !(i.produtoId === produtoId && i.tamanho === tamanho));
    salvarCarrinho(itens);
    renderizarCarrinho();
  }

  carrinhoLista.addEventListener("click", (evento: MouseEvent) => {
    const alvo = evento.target as HTMLElement;
    const linha = alvo.closest<HTMLDivElement>(".carrinho-item");
    if (!linha) return;

    const produtoId = linha.dataset.id as string;
    const tamanho = linha.dataset.tamanho as string;

    if (alvo.closest(".btn-qtd-mais")) mudarQuantidade(produtoId, tamanho, 1);
    if (alvo.closest(".btn-qtd-menos")) mudarQuantidade(produtoId, tamanho, -1);
    if (alvo.closest(".carrinho-item-remover")) removerItem(produtoId, tamanho);
  });

  function renderizarCarrinho(): void {
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
        if (!produto) return "";

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
    avisoLogin.hidden = Boolean(obterUsuario());

    atualizarHeaderConta(RAIZ);
  }

  function finalizarCompra(): void {
    if (!obterUsuario()) {
      window.location.href = `${RAIZ}login/index.html?next=checkout/index.html`;
      return;
    }

    window.location.href = `${RAIZ}checkout/index.html`;
  }

  botaoFinalizar.addEventListener("click", finalizarCompra);

  async function iniciarCarrinho(): Promise<void> {
    atualizarHeaderConta(RAIZ);
    catalogo = await carregarProdutos(`${RAIZ}data/products.json`);
    renderizarCarrinho();
  }

  iniciarCarrinho();
})();
