/**
 * produto.ts — lógica da página de detalhes de um produto (produto/index.html).
 *
 * A página não sabe de qual produto se trata até rodar: ela lê o "?id=..."
 * da própria URL, procura esse id dentro do catálogo (o mesmo
 * data/products.json que a vitrine usa) e desenha os detalhes na tela. É
 * por isso que o link do card na vitrine (ver ts/app.ts) é sempre
 * "produto/index.html?id=algum-id" — a página de produto é genérica, o "id"
 * na URL que decide o que ela mostra.
 */
(function () {
  // RAIZ = como voltar da pasta produto/ até a raiz do site, usado em todo
  // caminho relativo (imagens, fetch do catálogo, links de navegação)
  const RAIZ = "../";

  const breadcrumb = document.getElementById("breadcrumb") as HTMLElement;
  const detalheConteudo = document.getElementById("detalheConteudo") as HTMLElement;
  const detalheErro = document.getElementById("detalheErro") as HTMLParagraphElement;

  const detalheImagem = document.getElementById("detalheImagem") as HTMLImageElement;
  const detalheBtnAnterior = document.getElementById("detalheBtnAnterior") as HTMLButtonElement;
  const detalheBtnProxima = document.getElementById("detalheBtnProxima") as HTMLButtonElement;
  const detalheDots = document.getElementById("detalheDots") as HTMLDivElement;

  const detalheCategoria = document.getElementById("detalheCategoria") as HTMLSpanElement;
  const detalheNome = document.getElementById("detalheNome") as HTMLHeadingElement;
  const detalhePreco = document.getElementById("detalhePreco") as HTMLParagraphElement;
  const detalheTamanhos = document.getElementById("detalheTamanhos") as HTMLDivElement;
  const detalheDescricao = document.getElementById("detalheDescricao") as HTMLParagraphElement;

  const qtdValor = document.getElementById("qtdValor") as HTMLSpanElement;
  const qtdMenos = document.getElementById("qtdMenos") as HTMLButtonElement;
  const qtdMais = document.getElementById("qtdMais") as HTMLButtonElement;
  const botaoAdicionar = document.getElementById("botaoAdicionar") as HTMLButtonElement;
  const botaoComprarAgora = document.getElementById("botaoComprarAgora") as HTMLButtonElement;

  let fotos: string[] = [];
  let indiceFoto = 0;
  let quantidade = 1;
  // guarda o produto carregado pra "adicionar ao carrinho"/"comprar agora"
  // saberem qual produto é, sem precisar buscar no catálogo de novo
  let produtoAtual: Produto | null = null;

  /* ============================================================
   * Galeria de fotos (frente/costas)
   * ============================================================ */

  function atualizarFoto(): void {
    detalheImagem.src = fotos[indiceFoto];
    const pontos = detalheDots.querySelectorAll<HTMLSpanElement>(".dot");
    pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indiceFoto));
  }

  function mudarFoto(delta: number): void {
    indiceFoto = (indiceFoto + delta + fotos.length) % fotos.length;
    atualizarFoto();
  }

  detalheBtnAnterior.addEventListener("click", () => mudarFoto(-1));
  detalheBtnProxima.addEventListener("click", () => mudarFoto(1));

  /* ============================================================
   * Tamanhos
   * ============================================================ */

  /** Desenha um botão por tamanho disponível (campo "tamanhos" do produto), com o primeiro pré-selecionado. */
  function renderizarTamanhos(tamanhos: string[] | undefined): void {
    detalheTamanhos.innerHTML = (tamanhos ?? [])
      .map((tamanho, i) => `<button type="button" class="tamanho-opcao${i === 0 ? " selecionado" : ""}" data-tamanho="${tamanho}">${tamanho}</button>`)
      .join("");
  }

  // um único listener no container (em vez de um por botão) porque os botões
  // são recriados toda vez que renderizarTamanhos roda — delegar o clique pro
  // pai evita ter que reconectar o evento sempre que o HTML é substituído
  detalheTamanhos.addEventListener("click", (evento: MouseEvent) => {
    const alvo = evento.target as HTMLElement;
    if (!alvo.classList.contains("tamanho-opcao")) return;

    // clicar de novo no tamanho já selecionado DESMARCA ele (fica sem
    // nenhum selecionado); clicar em outro troca a seleção, como antes
    const jaSelecionado = alvo.classList.contains("selecionado");

    detalheTamanhos.querySelectorAll<HTMLButtonElement>(".tamanho-opcao").forEach((botao) => {
      botao.classList.toggle("selecionado", !jaSelecionado && botao === alvo);
    });
  });

  /* ============================================================
   * Quantidade
   * ============================================================ */

  function atualizarQuantidade(): void {
    qtdValor.textContent = String(quantidade);
    qtdMenos.disabled = quantidade <= 1; // não deixa ir abaixo de 1
  }

  qtdMenos.addEventListener("click", () => {
    quantidade = Math.max(1, quantidade - 1);
    atualizarQuantidade();
  });

  qtdMais.addEventListener("click", () => {
    quantidade += 1;
    atualizarQuantidade();
  });

  /* ============================================================
   * Adicionar ao carrinho / Comprar agora
   * ============================================================
   * Os dois botões fazem a MESMA coisa primeiro (guardar o produto atual,
   * no tamanho escolhido, na quantidade escolhida) — só o que acontece
   * DEPOIS é diferente: "Adicionar ao carrinho" continua na página (o
   * cliente pode estar só comparando produtos), "Comprar agora" já leva
   * direto pro carrinho, pra quem já sabe que quer aquele produto.
   * ============================================================ */

  /**
   * Lê o tamanho selecionado na tela e chama adicionarAoCarrinho (de
   * shared.ts). Se o produto tem tamanhos e nenhum está selecionado
   * (possível agora que dá pra desmarcar clicando de novo), não adiciona
   * nada — só avisa visualmente (a caixa de tamanhos "treme") e devolve
   * false, pra quem chamou saber que não deu certo.
   */
  function guardarProdutoAtualNoCarrinho(): boolean {
    if (!produtoAtual) return false;

    const tamanhoSelecionado = detalheTamanhos.querySelector<HTMLButtonElement>(".tamanho-opcao.selecionado");
    const precisaEscolherTamanho = (produtoAtual.tamanhos?.length ?? 0) > 0 && !tamanhoSelecionado;

    if (precisaEscolherTamanho) {
      detalheTamanhos.classList.remove("erro");
      // força o navegador a "esquecer" que a animação já rodou, senão clicar
      // duas vezes seguidas sem escolher tamanho não tremeria na segunda vez
      void detalheTamanhos.offsetWidth;
      detalheTamanhos.classList.add("erro");
      return false;
    }

    const tamanho = tamanhoSelecionado?.dataset.tamanho ?? "único";
    adicionarAoCarrinho(produtoAtual.id, tamanho, quantidade);
    atualizarHeaderConta(RAIZ); // atualiza o número no ícone do carrinho no cabeçalho
    return true;
  }

  botaoAdicionar.addEventListener("click", () => {
    if (!guardarProdutoAtualNoCarrinho()) return;

    // feedback rápido no próprio botão ("Adicionado ✓" por 1.2s) em vez de
    // navegar pra algum lugar — o cliente continua na mesma página
    const textoOriginal = botaoAdicionar.textContent;
    botaoAdicionar.textContent = "Adicionado ✓";
    botaoAdicionar.disabled = true;
    window.setTimeout(() => {
      botaoAdicionar.textContent = textoOriginal;
      botaoAdicionar.disabled = false;
    }, 1200);
  });

  botaoComprarAgora.addEventListener("click", () => {
    if (!guardarProdutoAtualNoCarrinho()) return;
    window.location.href = `${RAIZ}carrinho/index.html`;
  });

  /* ============================================================
   * Montagem da página a partir do produto encontrado
   * ============================================================ */

  /** Preenche toda a página (foto, nome, preço, tamanhos, descrição, breadcrumb) com os dados de um produto. */
  function renderizarProduto(produto: Produto): void {
    produtoAtual = produto;
    fotos = produto.imagemCostas
      ? [RAIZ + produto.imagem, RAIZ + produto.imagemCostas]
      : [RAIZ + produto.imagem];
    indiceFoto = 0;

    detalheImagem.alt = produto.nome;
    detalheCategoria.textContent = capitalizar(produto.categoria);
    detalheNome.textContent = produto.nome;
    detalhePreco.textContent = formatarPreco(produto.preco);
    detalheDescricao.textContent = produto.descricao;
    renderizarTamanhos(produto.tamanhos);
    atualizarQuantidade();

    // setas e bolinhas de foto só aparecem se o produto tiver as duas fotos (frente + costas)
    const temVariasFotos = fotos.length > 1;
    detalheBtnAnterior.hidden = !temVariasFotos;
    detalheBtnProxima.hidden = !temVariasFotos;
    detalheDots.hidden = !temVariasFotos;
    detalheDots.innerHTML = fotos
      .map((_, i) => `<span class="dot${i === 0 ? " ativo" : ""}"></span>`)
      .join("");

    atualizarFoto();

    breadcrumb.innerHTML = `<a href="../index.html">Início</a> / <span>${capitalizar(produto.categoria)}</span> / <span>${produto.nome}</span>`;
    document.title = `${produto.nome} — Pijamoon`;
  }

  /** Esconde os detalhes do produto e mostra a mensagem de erro (ex: id inválido na URL). */
  function mostrarErro(): void {
    detalheConteudo.hidden = true;
    detalheErro.hidden = false;
  }

  /**
   * Ponto de entrada da página: lê o "id" da URL, busca o catálogo inteiro
   * via fetch e procura o produto com esse id. Se não achar (id errado ou
   * inexistente) ou se o fetch falhar, mostra a tela de erro em vez de
   * deixar a página em branco.
   */
  async function iniciarPaginaProduto(): Promise<void> {
    atualizarHeaderConta(RAIZ);

    const parametros = new URLSearchParams(window.location.search);
    const id = parametros.get("id");

    try {
      const produtos = await carregarProdutos(`${RAIZ}data/products.json`);
      const produto = produtos.find((p) => p.id === id);

      if (!produto) {
        mostrarErro();
        return;
      }

      renderizarProduto(produto);
    } catch (erro) {
      mostrarErro();
      console.error(erro);
    }
  }

  iniciarPaginaProduto();
})();
