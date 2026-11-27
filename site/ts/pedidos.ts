/**
 * pedidos.ts — página "Meus pedidos" (pedidos/index.html).
 *
 * Busca GET /api/orders com o token do Cognito. A API descobre quem é o
 * cliente pelo token (claim "sub") e devolve só os pedidos dele, do mais
 * novo para o mais antigo.
 */
(function () {
  // RAIZ = como voltar da pasta pedidos/ até a raiz do site
  const RAIZ = "../";

  const carregando = document.getElementById("pedidosCarregando") as HTMLParagraphElement;
  const erro = document.getElementById("pedidosErro") as HTMLParagraphElement;
  const vazio = document.getElementById("pedidosVazio") as HTMLDivElement;
  const lista = document.getElementById("pedidosLista") as HTMLUListElement;

  interface ItemPedido {
    nome: string;
    tamanho: string;
    quantidade: number;
    subtotal: number;
  }

  interface Pedido {
    pedidoId: string;
    criadoEm: string;
    status: string;
    total: number;
    pagamento: string;
    itens: ItemPedido[];
  }

  const irParaLogin = () => {
    window.location.href = `${RAIZ}login/index.html?next=pedidos/index.html`;
  };

  /** Cria um elemento com classe e texto. textContent: nada vindo da API vira HTML. */
  function criar<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texto = ""): HTMLElementTagNameMap[K] {
    const elemento = document.createElement(tag);
    elemento.className = classe;
    elemento.textContent = texto;
    return elemento;
  }

  function cartaoDoPedido(pedido: Pedido): HTMLLIElement {
    const cartao = criar("li", "pedido-cartao");

    const topo = criar("div", "pedido-cartao-topo");
    const data = new Date(pedido.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    topo.append(criar("span", "pedido-cartao-data", data));
    const confirmado = pedido.status === "CONFIRMADO";
    topo.append(
      criar(
        "span",
        `pedido-status ${confirmado ? "pedido-status-confirmado" : "pedido-status-processando"}`,
        confirmado ? "Confirmado ✓" : "Processando",
      ),
    );
    cartao.append(topo);

    const itens = criar("ul", "pedido-cartao-itens");
    for (const item of pedido.itens ?? []) {
      const linha = criar("li", "");
      linha.append(criar("span", "", `${item.nome} (${item.tamanho}) × ${item.quantidade}`));
      linha.append(criar("strong", "", formatarPreco(item.subtotal)));
      itens.append(linha);
    }
    cartao.append(itens);

    const rodape = criar("div", "pedido-cartao-rodape");
    rodape.append(criar("code", "pedido-cartao-numero", `Nº ${pedido.pedidoId.slice(0, 8)}`));
    rodape.append(criar("span", "", pedido.pagamento === "pix" ? "Pix" : "Cartão"));
    rodape.append(criar("strong", "pedido-cartao-total", formatarPreco(pedido.total)));
    cartao.append(rodape);

    return cartao;
  }

  async function iniciarPedidos(): Promise<void> {
    atualizarHeaderConta(RAIZ);

    const token = await obterTokenValido();
    if (!token) return irParaLogin();

    try {
      const resposta = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
      if (resposta.status === 401) {
        sairUsuario();
        return irParaLogin();
      }
      if (!resposta.ok) throw new Error(String(resposta.status));

      const pedidos: Pedido[] = await resposta.json();
      carregando.hidden = true;
      if (pedidos.length === 0) {
        vazio.hidden = false;
        return;
      }
      lista.replaceChildren(...pedidos.map(cartaoDoPedido));
      lista.hidden = false;
    } catch {
      carregando.hidden = true;
      erro.textContent = "Não foi possível carregar os seus pedidos agora. Tente de novo em instantes.";
      erro.hidden = false;
    }
  }

  iniciarPedidos();
})();
