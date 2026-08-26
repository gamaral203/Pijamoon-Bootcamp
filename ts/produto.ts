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

let fotos: string[] = [];
let indiceFoto = 0;
let quantidade = 1;

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

function renderizarTamanhos(tamanhos: string[] | undefined): void {
  detalheTamanhos.innerHTML = (tamanhos ?? [])
    .map((tamanho, i) => `<button type="button" class="tamanho-opcao${i === 0 ? " selecionado" : ""}" data-tamanho="${tamanho}">${tamanho}</button>`)
    .join("");
}

detalheTamanhos.addEventListener("click", (evento: MouseEvent) => {
  const alvo = evento.target as HTMLElement;
  if (!alvo.classList.contains("tamanho-opcao")) return;

  detalheTamanhos.querySelectorAll<HTMLButtonElement>(".tamanho-opcao").forEach((botao) => {
    botao.classList.toggle("selecionado", botao === alvo);
  });
});

function atualizarQuantidade(): void {
  qtdValor.textContent = String(quantidade);
  qtdMenos.disabled = quantidade <= 1;
}

qtdMenos.addEventListener("click", () => {
  quantidade = Math.max(1, quantidade - 1);
  atualizarQuantidade();
});

qtdMais.addEventListener("click", () => {
  quantidade += 1;
  atualizarQuantidade();
});

function renderizarProduto(produto: Produto): void {
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

function mostrarErro(): void {
  detalheConteudo.hidden = true;
  detalheErro.hidden = false;
}

async function iniciarPaginaProduto(): Promise<void> {
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
