(function () {
  const RAIZ = "../";

  const checkoutConteudo = document.getElementById("checkoutConteudo") as HTMLFormElement;
  const checkoutSucesso = document.getElementById("checkoutSucesso") as HTMLDivElement;
  const checkoutItens = document.getElementById("checkoutItens") as HTMLDivElement;
  const checkoutTotal = document.getElementById("checkoutTotal") as HTMLElement;

  const metodoCartao = document.getElementById("metodoCartao") as HTMLInputElement;
  const metodoPix = document.getElementById("metodoPix") as HTMLInputElement;
  const painelCartao = document.getElementById("painelCartao") as HTMLDivElement;
  const painelPix = document.getElementById("painelPix") as HTMLDivElement;
  const camposCartao = painelCartao.querySelectorAll<HTMLInputElement>("input");

  const botaoCopiarPix = document.getElementById("botaoCopiarPix") as HTMLButtonElement;
  const codigoPix = document.getElementById("codigoPix") as HTMLElement;

  function alternarMetodoPagamento(): void {
    painelCartao.hidden = !metodoCartao.checked;
    painelPix.hidden = !metodoPix.checked;

    // display:none não tira campo da validação do form (só "disabled" tira) —
    // por isso alterna o "required" junto, senão o Pix ficava bloqueado pedindo
    // dados de cartão que nem aparecem na tela
    camposCartao.forEach((campo) => {
      campo.required = metodoCartao.checked;
    });
  }

  metodoCartao.addEventListener("change", alternarMetodoPagamento);
  metodoPix.addEventListener("change", alternarMetodoPagamento);

  botaoCopiarPix.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codigoPix.textContent ?? "");
      const textoOriginal = botaoCopiarPix.textContent;
      botaoCopiarPix.textContent = "Copiado!";
      setTimeout(() => {
        botaoCopiarPix.textContent = textoOriginal;
      }, 1500);
    } catch {
      // clipboard pode ser bloqueado (ex: sem HTTPS); simulação não depende disso
    }
  });

  function renderizarResumo(catalogo: Produto[]): number {
    const itens = obterCarrinho();
    let total = 0;

    checkoutItens.innerHTML = itens
      .map((item) => {
        const produto = catalogo.find((p) => p.id === item.produtoId);
        if (!produto) return "";

        const subtotal = produto.preco * item.quantidade;
        total += subtotal;

        return `
          <div class="checkout-item">
            <span>${produto.nome} (${item.tamanho}) × ${item.quantidade}</span>
            <strong>${formatarPreco(subtotal)}</strong>
          </div>
        `;
      })
      .join("");

    checkoutTotal.textContent = formatarPreco(total);
    return total;
  }

  function confirmarPagamento(): void {
    salvarCarrinho([]);
    checkoutConteudo.hidden = true;
    checkoutSucesso.hidden = false;
    atualizarHeaderConta(RAIZ);
  }

  checkoutConteudo.addEventListener("submit", (evento: SubmitEvent) => {
    evento.preventDefault();
    confirmarPagamento();
  });

  async function iniciarCheckout(): Promise<void> {
    atualizarHeaderConta(RAIZ);

    if (!obterUsuario()) {
      window.location.href = `${RAIZ}login/index.html?next=checkout/index.html`;
      return;
    }

    if (obterCarrinho().length === 0) {
      window.location.href = `${RAIZ}carrinho/index.html`;
      return;
    }

    const catalogo = await carregarProdutos(`${RAIZ}data/products.json`);
    renderizarResumo(catalogo);
  }

  iniciarCheckout();
})();
