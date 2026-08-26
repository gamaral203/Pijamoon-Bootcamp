interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagem: string;
  imagemCostas?: string;
  focoHero?: number;
}

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

const modalOverlay = document.getElementById("modalOverlay") as HTMLDivElement;
const modalFechar = document.getElementById("modalFechar") as HTMLButtonElement;
const modalImagem = document.getElementById("modalImagem") as HTMLImageElement;
const modalBtnAnterior = document.getElementById("modalBtnAnterior") as HTMLButtonElement;
const modalBtnProxima = document.getElementById("modalBtnProxima") as HTMLButtonElement;
const modalDots = document.getElementById("modalDots") as HTMLDivElement;
const modalCategoria = document.getElementById("modalCategoria") as HTMLSpanElement;
const modalNome = document.getElementById("modalNome") as HTMLHeadingElement;
const modalDescricao = document.getElementById("modalDescricao") as HTMLParagraphElement;
const modalPreco = document.getElementById("modalPreco") as HTMLParagraphElement;

let catalogo: Produto[] = [];
let categoriaAtual = "todas";
let modalFotos: string[] = [];
let modalIndice = 0;

let heroIndice = 0;
let heroTimer: number | undefined;

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

function iniciarAutoplayHero(): void {
  pararAutoplayHero();
  const prefereReduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefereReduzirMovimento) return;
  heroTimer = window.setInterval(() => irParaSlideHero(heroIndice + 1), 5000);
}

function mudarSlideHero(delta: number): void {
  irParaSlideHero(heroIndice + delta);
  iniciarAutoplayHero();
}

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

async function carregarProdutos(): Promise<Produto[]> {
  const resposta = await fetch("data/products.json");
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar catálogo: ${resposta.status}`);
  }
  return resposta.json();
}

function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fecharDropdownCategorias(): void {
  categoriasMenu.classList.remove("aberto");
  categoriasTrigger.setAttribute("aria-expanded", "false");
}

function selecionarCategoria(categoria: string): void {
  categoriaAtual = categoria;
  const botoes = categoriasMenu.querySelectorAll<HTMLButtonElement>(".categoria-link");
  botoes.forEach((botao) => botao.classList.toggle("ativo", botao.dataset.categoria === categoria));
  fecharDropdownCategorias();
  aplicarFiltros();
}

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

document.addEventListener("click", (evento: MouseEvent) => {
  if (!categoriasDropdown.contains(evento.target as Node)) {
    fecharDropdownCategorias();
  }
});

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

    botaoAnterior.addEventListener("click", (evento: MouseEvent) => {
      evento.stopPropagation();
      mudarFoto(-1);
    });

    botaoProxima.addEventListener("click", (evento: MouseEvent) => {
      evento.stopPropagation();
      mudarFoto(1);
    });
  }

  card.addEventListener("click", () => abrirModal(produto));

  return card;
}

function atualizarFotoModal(): void {
  modalImagem.src = modalFotos[modalIndice];
  const pontos = modalDots.querySelectorAll<HTMLSpanElement>(".dot");
  pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === modalIndice));
}

function abrirModal(produto: Produto): void {
  modalFotos = produto.imagemCostas ? [produto.imagem, produto.imagemCostas] : [produto.imagem];
  modalIndice = 0;

  modalImagem.alt = produto.nome;
  modalCategoria.textContent = capitalizar(produto.categoria);
  modalNome.textContent = produto.nome;
  modalDescricao.textContent = produto.descricao;
  modalPreco.textContent = formatarPreco(produto.preco);

  const temVariasFotos = modalFotos.length > 1;
  modalBtnAnterior.hidden = !temVariasFotos;
  modalBtnProxima.hidden = !temVariasFotos;
  modalDots.hidden = !temVariasFotos;

  atualizarFotoModal();

  modalOverlay.hidden = false;
  modalFechar.focus();
}

function fecharModal(): void {
  modalOverlay.hidden = true;
}

modalFechar.addEventListener("click", fecharModal);

modalOverlay.addEventListener("click", (evento: MouseEvent) => {
  if (evento.target === modalOverlay) {
    fecharModal();
  }
});

function mudarFotoModal(delta: number): void {
  modalIndice = (modalIndice + delta + modalFotos.length) % modalFotos.length;
  atualizarFotoModal();
}

modalBtnAnterior.addEventListener("click", () => mudarFotoModal(-1));
modalBtnProxima.addEventListener("click", () => mudarFotoModal(1));

document.addEventListener("keydown", (evento: KeyboardEvent) => {
  if (evento.key === "Escape" && !modalOverlay.hidden) {
    fecharModal();
  }
});

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

function aplicarFiltros(): void {
  const termo = campoBusca.value.trim().toLowerCase();

  const filtrado = catalogo.filter((produto) => {
    const bateCategoria = categoriaAtual === "todas" || produto.categoria === categoriaAtual;
    const bateBusca = produto.nome.toLowerCase().includes(termo);
    return bateCategoria && bateBusca;
  });

  renderizarProdutos(filtrado);
}

async function iniciar(): Promise<void> {
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
