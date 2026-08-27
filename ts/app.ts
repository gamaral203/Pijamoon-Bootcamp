/**
 * app.ts — lógica da vitrine (index.html): hero em carrossel, busca, filtro
 * por categoria e a grade de produtos.
 *
 * Tudo dentro de um único (function () { ... })() (uma IIFE — "Immediately
 * Invoked Function Expression") pra não vazar nenhuma dessas variáveis/
 * funções pro escopo global. Sem isso, se produto.ts também tivesse uma
 * variável chamada "catalogo", o TypeScript reclamaria de redeclaração —
 * mesmo os dois nunca rodando na mesma página — porque sem bundler/módulos
 * ele compila todo o projeto como se fosse um escopo só. Só shared.ts fica
 * de fato global, de propósito, porque as outras páginas precisam dele.
 */
(function () {
  // --- Referências aos elementos do HTML que este script manipula ---
  const containerProdutos = document.getElementById("produtos") as HTMLDivElement;
  const campoBusca = document.getElementById("busca") as HTMLInputElement;
  const statusBusca = document.getElementById("status") as HTMLParagraphElement;

  const heroSlides = document.getElementById("heroSlides") as HTMLDivElement;
  const heroDots = document.getElementById("heroDots") as HTMLDivElement;
  const heroBtnAnterior = document.getElementById("heroBtnAnterior") as HTMLButtonElement;
  const heroBtnProxima = document.getElementById("heroBtnProxima") as HTMLButtonElement;

  const categoriasDropdown = document.getElementById("categoriasDropdown") as HTMLDivElement;
  const categoriasTrigger = document.getElementById("categoriasTrigger") as HTMLButtonElement;
  const categoriasMenu = document.getElementById("categoriasMenu") as HTMLDivElement;

  // catalogo guarda os produtos depois do fetch; categoriaAtual é o filtro ativo no momento
  let catalogo: Produto[] = [];
  let categoriaAtual = "todas";

  let heroIndice = 0;
  let heroTimer: number | undefined;

  /* ============================================================
   * Hero: carrossel de fotos da coleção
   * ============================================================ */

  /** Mostra o slide de índice "indice" (com wraparound: -1 vira o último, N vira o 0). */
  function irParaSlideHero(indice: number): void {
    const slides = heroSlides.querySelectorAll<HTMLImageElement>(".hero-slide");
    const dots = heroDots.querySelectorAll<HTMLSpanElement>(".dot");
    if (slides.length === 0) return;

    heroIndice = (indice + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("ativo", i === heroIndice));
    dots.forEach((dot, i) => dot.classList.toggle("ativo", i === heroIndice));
  }

  function pararAutoplayHero(): void {
    if (heroTimer !== undefined) {
      window.clearInterval(heroTimer);
      heroTimer = undefined;
    }
  }

  /** Liga o autoplay (troca de slide a cada 5s) — a menos que o usuário tenha
   *  pedido pro sistema operacional reduzir movimento (acessibilidade). */
  function iniciarAutoplayHero(): void {
    pararAutoplayHero();
    const prefereReduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefereReduzirMovimento) return;
    heroTimer = window.setInterval(() => irParaSlideHero(heroIndice + 1), 5000);
  }

  /** Troca de slide manualmente (seta anterior/próxima) e reinicia o timer do autoplay. */
  function mudarSlideHero(delta: number): void {
    irParaSlideHero(heroIndice + delta);
    iniciarAutoplayHero();
  }

  /**
   * Gera os slides do hero a partir do próprio catálogo — usa a mesma foto
   * "imagem" de cada produto, sem duplicar caminho nenhum. Cada foto ganha
   * seu ponto de corte vertical (object-position) via o campo focoHero do
   * products.json, porque as fotos são em retrato e o hero é bem mais largo
   * que alto — sem isso, a foto ficaria cortada mostrando só o rosto ou só
   * os pés, dependendo da pose.
   */
  function renderizarHero(produtos: Produto[]): void {
    if (produtos.length === 0) return;

    heroSlides.innerHTML = produtos
      .map((produto, i) => {
        const foco = produto.focoHero ?? 45;
        return `<img src="${produto.imagem}" alt="" class="hero-slide${i === 0 ? " ativo" : ""}" style="object-position: center ${foco}%" loading="${i === 0 ? "eager" : "lazy"}">`;
      })
      .join("");

    heroDots.innerHTML = produtos
      .map((_, i) => `<span class="dot${i === 0 ? " ativo" : ""}"></span>`)
      .join("");

    heroIndice = 0;
    iniciarAutoplayHero();
  }

  heroBtnAnterior.addEventListener("click", () => mudarSlideHero(-1));
  heroBtnProxima.addEventListener("click", () => mudarSlideHero(1));

  // clique numa bolinha do carrossel pula direto pra aquele slide
  heroDots.addEventListener("click", (evento: MouseEvent) => {
    const alvo = evento.target as HTMLElement;
    if (!alvo.classList.contains("dot")) return;

    const dots = Array.from(heroDots.querySelectorAll<HTMLSpanElement>(".dot"));
    const indice = dots.indexOf(alvo as HTMLSpanElement);
    if (indice >= 0) {
      irParaSlideHero(indice);
      iniciarAutoplayHero();
    }
  });

  /* ============================================================
   * Dropdown de categorias (cabeçalho)
   * ============================================================ */

  function fecharDropdownCategorias(): void {
    categoriasMenu.classList.remove("aberto");
    categoriasTrigger.setAttribute("aria-expanded", "false");
  }

  /** Marca a categoria clicada como ativa, fecha o menu e refiltra a grade. */
  function selecionarCategoria(categoria: string): void {
    categoriaAtual = categoria;
    const botoes = categoriasMenu.querySelectorAll<HTMLButtonElement>(".categoria-link");
    botoes.forEach((botao) => botao.classList.toggle("ativo", botao.dataset.categoria === categoria));
    fecharDropdownCategorias();
    aplicarFiltros();
  }

  /**
   * Monta os botões de categoria dinamicamente a partir do que existe no
   * catálogo (Set remove duplicatas) — se um produto novo com categoria nova
   * for adicionado no products.json, o botão dela aparece sozinho, sem
   * precisar editar HTML nenhum. É o mesmo princípio de "catálogo separado
   * do front" aplicado aqui: o menu de categorias reflete os dados, não o
   * contrário.
   */
  function popularCategorias(produtos: Produto[]): void {
    const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
    for (const categoria of categorias) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "categoria-link";
      botao.dataset.categoria = categoria;
      botao.setAttribute("role", "menuitem");
      botao.textContent = capitalizar(categoria);
      categoriasMenu.appendChild(botao);
    }

    categoriasMenu.querySelectorAll<HTMLButtonElement>(".categoria-link").forEach((botao) => {
      botao.addEventListener("click", () => selecionarCategoria(botao.dataset.categoria as string));
    });
  }

  categoriasTrigger.addEventListener("click", () => {
    const aberto = categoriasMenu.classList.toggle("aberto");
    categoriasTrigger.setAttribute("aria-expanded", String(aberto));
  });

  // clicar fora do dropdown fecha ele
  document.addEventListener("click", (evento: MouseEvent) => {
    if (!categoriasDropdown.contains(evento.target as Node)) {
      fecharDropdownCategorias();
    }
  });

  /* ============================================================
   * Grade de produtos
   * ============================================================ */

  const iconeAnterior = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 6 9 12 15 18"></polyline>
    </svg>
  `;

  const iconeProxima = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 6 15 12 9 18"></polyline>
    </svg>
  `;

  /**
   * Monta o <article> de um produto na grade: foto, categoria, nome,
   * descrição e preço. Se o produto tem foto de costas, também monta as
   * setinhas e as bolinhas de trocar foto direto no card (sem precisar abrir
   * a página de detalhes pra ver o produto de outro ângulo).
   */
  function criarCardProduto(produto: Produto): HTMLElement {
    const card = document.createElement("article");
    card.className = "produto-card";

    const temSegundaFoto = Boolean(produto.imagemCostas);

    card.innerHTML = `
      <div class="produto-imagem-wrapper">
        <img src="${produto.imagem}" alt="${produto.nome}" loading="lazy" class="produto-imagem">
        ${temSegundaFoto ? `
          <button type="button" class="btn-alternar-foto btn-anterior" aria-label="Foto anterior" title="Foto anterior">
            ${iconeAnterior}
          </button>
          <button type="button" class="btn-alternar-foto btn-proxima" aria-label="Próxima foto" title="Próxima foto">
            ${iconeProxima}
          </button>
          <div class="produto-fotos-dots" aria-hidden="true">
            <span class="dot ativo"></span>
            <span class="dot"></span>
          </div>
        ` : ""}
      </div>
      <div class="produto-info">
        <span class="produto-categoria">${capitalizar(produto.categoria)}</span>
        <h2>${produto.nome}</h2>
        <p class="produto-descricao">${produto.descricao}</p>
        <p class="produto-preco">${formatarPreco(produto.preco)}</p>
      </div>
    `;

    if (temSegundaFoto) {
      const fotos = [produto.imagem, produto.imagemCostas as string];
      const imagemEl = card.querySelector<HTMLImageElement>(".produto-imagem")!;
      const botaoAnterior = card.querySelector<HTMLButtonElement>(".btn-anterior")!;
      const botaoProxima = card.querySelector<HTMLButtonElement>(".btn-proxima")!;
      const pontos = card.querySelectorAll<HTMLSpanElement>(".dot");
      let indice = 0;

      function mudarFoto(delta: number): void {
        indice = (indice + delta + fotos.length) % fotos.length;
        imagemEl.src = fotos[indice];
        pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indice));
      }

      // stopPropagation() é essencial aqui: o card inteiro tem um clique que
      // abre a página do produto (ver mais abaixo) — sem isso, clicar na
      // setinha de trocar foto também "clicaria" o card e navegaria embora
      botaoAnterior.addEventListener("click", (evento: MouseEvent) => {
        evento.stopPropagation();
        mudarFoto(-1);
      });

      botaoProxima.addEventListener("click", (evento: MouseEvent) => {
        evento.stopPropagation();
        mudarFoto(1);
      });
    }

    // clicar em qualquer lugar do card (fora das setinhas) navega pra página de detalhes
    card.addEventListener("click", () => {
      window.location.href = `produto/index.html?id=${encodeURIComponent(produto.id)}`;
    });

    return card;
  }

  /** Limpa a grade e desenha um card por produto da lista — ou uma mensagem, se a lista vier vazia. */
  function renderizarProdutos(lista: Produto[]): void {
    containerProdutos.innerHTML = "";

    if (lista.length === 0) {
      containerProdutos.innerHTML = `<p class="sem-resultado">Nenhum pijama encontrado.</p>`;
      statusBusca.textContent = "Nenhum produto encontrado.";
      return;
    }

    for (const produto of lista) {
      containerProdutos.appendChild(criarCardProduto(produto));
    }

    statusBusca.textContent = `${lista.length} produto(s) encontrado(s).`;
  }

  /* ============================================================
   * Busca + filtro por categoria
   * ============================================================ */

  /**
   * Aplica os dois filtros juntos (texto da busca E categoria selecionada)
   * sobre o catálogo completo, e redesenha a grade com o resultado. Chamada
   * toda vez que o usuário digita na busca ou troca de categoria.
   */
  function aplicarFiltros(): void {
    const termo = campoBusca.value.trim().toLowerCase();

    const filtrado = catalogo.filter((produto) => {
      const bateCategoria = categoriaAtual === "todas" || produto.categoria === categoriaAtual;
      const bateBusca = produto.nome.toLowerCase().includes(termo);
      return bateCategoria && bateBusca;
    });

    renderizarProdutos(filtrado);
  }

  /* ============================================================
   * Inicialização da página
   * ============================================================ */

  /**
   * Ponto de entrada: sincroniza o cabeçalho (login/carrinho/tema), busca o
   * catálogo via fetch e, se der certo, monta o hero + categorias + grade.
   * Se o fetch falhar (ex: rodando o arquivo direto sem servidor, ou
   * products.json fora do ar), mostra uma mensagem de erro em vez de
   * quebrar a página.
   */
  async function iniciar(): Promise<void> {
    atualizarHeaderConta();

    try {
      catalogo = await carregarProdutos();
      renderizarHero(catalogo);
      popularCategorias(catalogo);
      renderizarProdutos(catalogo);
    } catch (erro) {
      containerProdutos.innerHTML = `<p class="erro">Não foi possível carregar os produtos agora.</p>`;
      statusBusca.textContent = "Erro ao carregar produtos.";
      console.error(erro);
    }
  }

  campoBusca.addEventListener("input", aplicarFiltros);

  iniciar();
})();
