/**
 * checkout.ts — lógica da página de finalizar compra (checkout/index.html):
 * endereço de entrega, forma de pagamento (cartão ou Pix) e confirmação.
 *
 * Ao confirmar, o pedido vai para a API da loja (POST /api/checkout), que
 * responde 202 Accepted com o número do pedido. A criação do pedido é
 * assíncrona (evento → fila → Lambda), então a página fica consultando
 * GET /api/orders/{número} até o pedido aparecer como confirmado.
 *
 * Quem é o cliente vai no token do Cognito (cabeçalho Authorization), e não
 * no corpo: o API Gateway confere o token antes de chamar a Lambda.
 *
 * O pagamento continua simulado: o site envia só o MÉTODO escolhido
 * ("cartao" ou "pix"). Número, validade e CVV do cartão nunca saem do
 * navegador, nem para a nossa própria API.
 */
(function () {
  // RAIZ = como voltar da pasta checkout/ até a raiz do site
  const RAIZ = "../";

  const checkoutConteudo = document.getElementById("checkoutConteudo") as HTMLFormElement;
  const checkoutSucesso = document.getElementById("checkoutSucesso") as HTMLDivElement;
  const checkoutItens = document.getElementById("checkoutItens") as HTMLDivElement;
  const checkoutTotal = document.getElementById("checkoutTotal") as HTMLElement;
  const checkoutErro = document.getElementById("checkoutErro") as HTMLDivElement;
  const botaoConfirmar = document.getElementById("botaoConfirmarPagamento") as HTMLButtonElement;

  const sucessoNumero = document.getElementById("sucessoNumero") as HTMLElement;
  const sucessoTotal = document.getElementById("sucessoTotal") as HTMLElement;
  const sucessoStatus = document.getElementById("sucessoStatus") as HTMLElement;

  /** Lê o valor de um campo do formulário pelo id, sem espaços nas pontas. */
  const valorDe = (id: string): string =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value.trim();

  const metodoCartao = document.getElementById("metodoCartao") as HTMLInputElement;
  const metodoPix = document.getElementById("metodoPix") as HTMLInputElement;
  const painelCartao = document.getElementById("painelCartao") as HTMLDivElement;
  const painelPix = document.getElementById("painelPix") as HTMLDivElement;
  const camposCartao = painelCartao.querySelectorAll<HTMLInputElement>("input");

  const botaoCopiarPix = document.getElementById("botaoCopiarPix") as HTMLButtonElement;
  const codigoPix = document.getElementById("codigoPix") as HTMLElement;

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
  function alternarMetodoPagamento(): void {
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
    } catch {
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

  /** Resposta do POST /api/checkout quando o pedido é aceito (202). */
  interface PedidoRecebido {
    pedidoId: string;
    status: string;
    total: number;
  }

  /**
   * Monta o corpo do pedido com o que a API espera: itens do carrinho,
   * endereço e o método de pagamento. O preço NÃO vai (quem calcula o total
   * é a API, com o catálogo) e o cliente também não (vem do token).
   */
  function montarPedido() {
    return {
      itens: obterCarrinho().map(({ produtoId, tamanho, quantidade }) => ({ produtoId, tamanho, quantidade })),
      entrega: {
        cep: valorDe("campoCep"),
        rua: valorDe("campoRua"),
        numero: valorDe("campoNumero"),
        complemento: valorDe("campoComplemento"),
        bairro: valorDe("campoBairro"),
        cidade: valorDe("campoCidade"),
        estado: valorDe("campoEstado"),
      },
      pagamento: metodoPix.checked ? "pix" : "cartao",
    };
  }

  /**
   * Mostra um erro acima do botão. Usa textContent (e não innerHTML) de
   * propósito: a mensagem pode trazer texto vindo da API, e textContent
   * nunca interpreta HTML, então não abre brecha para injetar código na página.
   */
  function mostrarErro(titulo: string, detalhes: string[] = []): void {
    checkoutErro.replaceChildren();
    const paragrafo = document.createElement("p");
    paragrafo.textContent = titulo;
    checkoutErro.append(paragrafo);
    if (detalhes.length > 0) {
      const lista = document.createElement("ul");
      for (const detalhe of detalhes) {
        const item = document.createElement("li");
        item.textContent = detalhe;
        lista.append(item);
      }
      checkoutErro.append(lista);
    }
    checkoutErro.hidden = false;
  }

  /** Liga/desliga o estado "enviando" do botão, para ninguém clicar duas vezes. */
  function enviando(sim: boolean): void {
    botaoConfirmar.disabled = sim;
    botaoConfirmar.textContent = sim ? "Enviando pedido…" : "Confirmar pagamento";
  }

  const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

  /** Sessão acabou (token vencido e sem renovação): volta para o login e depois para cá. */
  function irParaLogin(): void {
    window.location.href = `${RAIZ}login/index.html?next=checkout/index.html`;
  }

  /**
   * A parte assíncrona, vista pelo cliente: o pedido foi aceito (202), mas
   * só existe depois que o serviço de pedidos processar o evento. A página
   * consulta a cada 1,5 s (abaixo do limite de 2 requisições por segundo da
   * API) por até ~30 s. Na prática, o pedido aparece em poucos segundos.
   */
  async function acompanharPedido(pedidoId: string): Promise<void> {
    for (let tentativa = 1; tentativa <= 20; tentativa++) {
      await esperar(1500);
      try {
        const token = await obterTokenValido();
        if (!token) break;
        const resposta = await fetch(`/api/orders/${encodeURIComponent(pedidoId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resposta.ok) {
          const pedido = await resposta.json();
          if (pedido.status === "CONFIRMADO") {
            sucessoStatus.textContent = "Pedido confirmado ✓";
            sucessoStatus.className = "pedido-status pedido-status-confirmado";
            return;
          }
        }
        // 404 = ainda em processamento; 429 = limite da API: só espera e tenta de novo
      } catch {
        // falha de rede momentânea: tenta de novo na próxima volta
      }
    }
    sucessoStatus.textContent =
      "Seu pedido foi recebido e ainda está sendo processado. Guarde o número acima.";
    sucessoStatus.className = "pedido-status pedido-status-processando";
  }

  /** Troca o formulário pela tela de pedido recebido e esvazia o carrinho. */
  function mostrarPedidoRecebido(pedido: PedidoRecebido): void {
    salvarCarrinho([]);
    sucessoNumero.textContent = pedido.pedidoId;
    sucessoTotal.textContent = formatarPreco(pedido.total);
    checkoutConteudo.hidden = true;
    checkoutSucesso.hidden = false;
    atualizarHeaderConta(RAIZ); // zera o número no ícone do carrinho, já que ele acabou de esvaziar
    window.scrollTo({ top: 0, behavior: "smooth" });
    acompanharPedido(pedido.pedidoId);
  }

  /**
   * Envia o pedido para a API. O carrinho só é esvaziado quando a API aceita
   * (202): se der erro, o cliente não perde o que escolheu.
   */
  async function confirmarPagamento(): Promise<void> {
    checkoutErro.hidden = true;
    enviando(true);
    try {
      // o "crachá": um ID token válido (renovado na hora, se tiver vencido)
      const token = await obterTokenValido();
      if (!token) return irParaLogin();

      const resposta = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(montarPedido()),
      });
      const corpo = await resposta.json().catch(() => ({}));

      if (resposta.status === 202) {
        mostrarPedidoRecebido(corpo as PedidoRecebido);
        return;
      }
      if (resposta.status === 401) {
        sairUsuario();
        return irParaLogin();
      }
      if (resposta.status === 400) {
        mostrarErro("Não deu para registrar o pedido. Confira:", corpo.detalhes ?? []);
      } else if (resposta.status === 429) {
        mostrarErro("Muitas tentativas em pouco tempo. Espere alguns segundos e tente de novo.");
      } else {
        mostrarErro("Não foi possível registrar o pedido agora. Tente de novo em instantes.");
      }
    } catch {
      mostrarErro("Sem conexão com a loja. Confira sua internet e tente de novo.");
    } finally {
      enviando(false);
    }
  }

  // o botão "Confirmar pagamento" é type="submit" dentro do <form>, então o
  // evento certo pra ouvir é o "submit" do form (aciona clicando no botão OU
  // apertando Enter em qualquer campo) — e precisa de preventDefault() pra
  // não deixar o navegador recarregar a página, que é o comportamento padrão
  checkoutConteudo.addEventListener("submit", (evento: SubmitEvent) => {
    evento.preventDefault();
    confirmarPagamento();
  });

  /**
   * Ponto de entrada: exige login (senão manda pra tela de login e volta
   * pra cá depois) e exige carrinho não-vazio (senão não faz sentido estar
   * numa tela de pagamento) antes de sequer desenhar o formulário.
   */
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

    const catalogo = await carregarProdutos();
    renderizarResumo(catalogo);
  }

  iniciarCheckout();
})();
