interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagem: string;
  imagemCostas?: string;
}

const containerProdutos = document.getElementById("produtos") as HTMLDivElement;
const campoBusca = document.getElementById("busca") as HTMLInputElement;
const seletorCategoria = document.getElementById("categoria") as HTMLSelectElement;
const statusBusca = document.getElementById("status") as HTMLParagraphElement;

const modalOverlay = document.getElementById("modalOverlay") as HTMLDivElement;
const modalFechar = document.getElementById("modalFechar") as HTMLButtonElement;
const modalImagem = document.getElementById("modalImagem") as HTMLImageElement;
const modalBtnAlternar = document.getElementById("modalBtnAlternar") as HTMLButtonElement;
const modalDots = document.getElementById("modalDots") as HTMLDivElement;
const modalCategoria = document.getElementById("modalCategoria") as HTMLSpanElement;
const modalNome = document.getElementById("modalNome") as HTMLHeadingElement;
const modalDescricao = document.getElementById("modalDescricao") as HTMLParagraphElement;
const modalPreco = document.getElementById("modalPreco") as HTMLParagraphElement;

let catalogo: Produto[] = [];
let modalFotos: string[] = [];
let modalIndice = 0;

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

function popularCategorias(produtos: Produto[]): void {
  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
  for (const categoria of categorias) {
    const opcao = document.createElement("option");
    opcao.value = categoria;
    opcao.textContent = categoria === "frio" ? "Pijamas de frio" : "Pijamas de calor";
    seletorCategoria.appendChild(opcao);
  }
}

const iconeAlternarFoto = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4v5h5"/>
    <path d="M20 20v-5h-5"/>
    <path d="M5 15a7 7 0 0 0 12.9 3.1M19 9A7 7 0 0 0 6.1 5.9"/>
  </svg>
`;

function criarCardProduto(produto: Produto): HTMLElement {
  const card = document.createElement("article");
  card.className = "produto-card";
  card.dataset.categoria = produto.categoria;

  const temSegundaFoto = Boolean(produto.imagemCostas);

  card.innerHTML = `
    <div class="produto-imagem-wrapper">
      <img src="${produto.imagem}" alt="${produto.nome}" loading="lazy" class="produto-imagem">
      ${temSegundaFoto ? `
        <button type="button" class="btn-alternar-foto" aria-label="Ver outra foto do produto" title="Ver outra foto">
          ${iconeAlternarFoto}
        </button>
        <div class="produto-fotos-dots" aria-hidden="true">
          <span class="dot ativo"></span>
          <span class="dot"></span>
        </div>
      ` : ""}
    </div>
    <div class="produto-info">
      <span class="produto-categoria">${produto.categoria}</span>
      <h2>${produto.nome}</h2>
      <p class="produto-descricao">${produto.descricao}</p>
      <p class="produto-preco">${formatarPreco(produto.preco)}</p>
    </div>
  `;

  if (temSegundaFoto) {
    const fotos = [produto.imagem, produto.imagemCostas as string];
    const imagemEl = card.querySelector<HTMLImageElement>(".produto-imagem")!;
    const botaoAlternar = card.querySelector<HTMLButtonElement>(".btn-alternar-foto")!;
    const pontos = card.querySelectorAll<HTMLSpanElement>(".dot");
    let indice = 0;

    botaoAlternar.addEventListener("click", (evento: MouseEvent) => {
      evento.stopPropagation();
      indice = (indice + 1) % fotos.length;
      imagemEl.src = fotos[indice];
      pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indice));
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
  modalCategoria.textContent = produto.categoria;
  modalNome.textContent = produto.nome;
  modalDescricao.textContent = produto.descricao;
  modalPreco.textContent = formatarPreco(produto.preco);

  const temVariasFotos = modalFotos.length > 1;
  modalBtnAlternar.hidden = !temVariasFotos;
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

modalBtnAlternar.addEventListener("click", () => {
  modalIndice = (modalIndice + 1) % modalFotos.length;
  atualizarFotoModal();
});

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
  const categoria = seletorCategoria.value;

  const filtrado = catalogo.filter((produto) => {
    const bateCategoria = categoria === "todas" || produto.categoria === categoria;
    const bateBusca = produto.nome.toLowerCase().includes(termo);
    return bateCategoria && bateBusca;
  });

  renderizarProdutos(filtrado);
}

async function iniciar(): Promise<void> {
  try {
    catalogo = await carregarProdutos();
    popularCategorias(catalogo);
    renderizarProdutos(catalogo);
  } catch (erro) {
    containerProdutos.innerHTML = `<p class="erro">Não foi possível carregar os produtos agora.</p>`;
    statusBusca.textContent = "Erro ao carregar produtos.";
    console.error(erro);
  }
}

campoBusca.addEventListener("input", aplicarFiltros);
seletorCategoria.addEventListener("change", aplicarFiltros);

iniciar();
