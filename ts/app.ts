interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagem: string;
}

const containerProdutos = document.getElementById("produtos") as HTMLDivElement;
const campoBusca = document.getElementById("busca") as HTMLInputElement;
const seletorCategoria = document.getElementById("categoria") as HTMLSelectElement;
const statusBusca = document.getElementById("status") as HTMLParagraphElement;

let catalogo: Produto[] = [];

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

function criarCardProduto(produto: Produto): HTMLElement {
  const card = document.createElement("article");
  card.className = "produto-card";
  card.dataset.categoria = produto.categoria;

  card.innerHTML = `
    <img src="${produto.imagem}" alt="${produto.nome}" loading="lazy">
    <div class="produto-info">
      <span class="produto-categoria">${produto.categoria}</span>
      <h2>${produto.nome}</h2>
      <p class="produto-descricao">${produto.descricao}</p>
      <p class="produto-preco">${formatarPreco(produto.preco)}</p>
    </div>
  `;

  return card;
}

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
