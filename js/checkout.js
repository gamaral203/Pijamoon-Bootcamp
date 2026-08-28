"use strict";
/**
 * checkout.ts — lógica da página de finalizar compra (checkout/index.html):
 * endereço de entrega, forma de pagamento (cartão ou Pix) e confirmação.
 *
 * Assim como o login, é tudo simulado: nenhum dado de endereço ou cartão é
 * enviado pra lugar nenhum, é só um formulário que precisa estar preenchido
 * (validação HTML5 com "required") pra poder "confirmar o pagamento" —
 * chega só até aí porque o desafio pede um checkout fictício, não uma
 * integração de pagamento de verdade.
 */
(function () {
    // RAIZ = como voltar da pasta checkout/ até a raiz do site
    const RAIZ = "../";
    const checkoutConteudo = document.getElementById("checkoutConteudo");
    const checkoutSucesso = document.getElementById("checkoutSucesso");
    const checkoutItens = document.getElementById("checkoutItens");
    const checkoutTotal = document.getElementById("checkoutTotal");
    const metodoCartao = document.getElementById("metodoCartao");
    const metodoPix = document.getElementById("metodoPix");
    const painelCartao = document.getElementById("painelCartao");
    const painelPix = document.getElementById("painelPix");
    const camposCartao = painelCartao.querySelectorAll("input");
    const botaoCopiarPix = document.getElementById("botaoCopiarPix");
    const codigoPix = document.getElementById("codigoPix");
    /**
     * Alterna qual painel de pagamento aparece (cartão ou Pix) conforme o
     * rádio escolhido.
     *
     * O detalhe importante: display:none esconde o painel de cartão, mas NÃO
     * tira os campos dele da validação do formulário (só o atributo
     * "disabled" faz isso). Sem a linha abaixo, escolher Pix travava o envio
     * do form, pedindo pra preencher número de cartão que nem aparecia mais
     * na tela — um bug real que apareceu testando e foi corrigido alternando
     * o "required" dos campos junto com a troca de método.
     */
    function alternarMetodoPagamento() {
        painelCartao.hidden = !metodoCartao.checked;
        painelPix.hidden = !metodoPix.checked;
        camposCartao.forEach((campo) => {
            campo.required = metodoCartao.checked;
        });
    }
    metodoCartao.addEventListener("change", alternarMetodoPagamento);
    metodoPix.addEventListener("change", alternarMetodoPagamento);
    // botão "Copiar" do código Pix — usa a Clipboard API do navegador
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
            // a Clipboard API pode ser bloqueada (ex: página sem HTTPS) — como é
            // só uma simulação, se falhar não faz diferença nenhuma, ignora
        }
    });
    /**
     * Desenha o resumo do pedido (lista de itens + total) na lateral da
     * página, cruzando o carrinho salvo com o catálogo. Retorna o total, mas
     * quem usa é só a própria função — está aqui de forma explícita porque
     * fica mais fácil de testar/entender o que ela calcula.
     */
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
    /** "Paga": esvazia o carrinho de verdade e troca o formulário pela tela de sucesso. */
    function confirmarPagamento() {
        salvarCarrinho([]);
        checkoutConteudo.hidden = true;
        checkoutSucesso.hidden = false;
        atualizarHeaderConta(RAIZ); // zera o número no ícone do carrinho, já que ele acabou de esvaziar
    }
    // o botão "Confirmar pagamento" é type="submit" dentro do <form>, então o
    // evento certo pra ouvir é o "submit" do form (aciona clicando no botão OU
    // apertando Enter em qualquer campo) — e precisa de preventDefault() pra
    // não deixar o navegador recarregar a página, que é o comportamento padrão
    checkoutConteudo.addEventListener("submit", (evento) => {
        evento.preventDefault();
        confirmarPagamento();
    });
    /**
     * Ponto de entrada: exige login (senão manda pra tela de login e volta
     * pra cá depois) e exige carrinho não-vazio (senão não faz sentido estar
     * numa tela de pagamento) antes de sequer desenhar o formulário.
     */
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
        const catalogo = await carregarProdutos();
        renderizarResumo(catalogo);
    }
    iniciarCheckout();
})();
//# sourceMappingURL=checkout.js.map