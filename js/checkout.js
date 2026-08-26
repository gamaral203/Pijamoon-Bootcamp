"use strict";
(function () {
    const RAIZ = "../";
    const checkoutConteudo = document.getElementById("checkoutConteudo");
    const checkoutSucesso = document.getElementById("checkoutSucesso");
    const checkoutItens = document.getElementById("checkoutItens");
    const checkoutTotal = document.getElementById("checkoutTotal");
    const metodoCartao = document.getElementById("metodoCartao");
    const metodoPix = document.getElementById("metodoPix");
    const painelCartao = document.getElementById("painelCartao");
    const painelPix = document.getElementById("painelPix");
    const botaoCopiarPix = document.getElementById("botaoCopiarPix");
    const codigoPix = document.getElementById("codigoPix");
    const botaoConfirmarPagamento = document.getElementById("botaoConfirmarPagamento");
    function alternarMetodoPagamento() {
        painelCartao.hidden = !metodoCartao.checked;
        painelPix.hidden = !metodoPix.checked;
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
        }
        catch {
            // clipboard pode ser bloqueado (ex: sem HTTPS); simulação não depende disso
        }
    });
    function renderizarResumo(catalogo) {
        const itens = obterCarrinho();
        let total = 0;
        checkoutItens.innerHTML = itens
            .map((item) => {
            const produto = catalogo.find((p) => p.id === item.produtoId);
            if (!produto)
                return "";
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
    function confirmarPagamento() {
        salvarCarrinho([]);
        checkoutConteudo.hidden = true;
        checkoutSucesso.hidden = false;
        atualizarHeaderConta(RAIZ);
    }
    botaoConfirmarPagamento.addEventListener("click", confirmarPagamento);
    async function iniciarCheckout() {
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
//# sourceMappingURL=checkout.js.map