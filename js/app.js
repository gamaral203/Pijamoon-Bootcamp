"use strict";
const containerProdutos = document.getElementById("produtos");
const campoBusca = document.getElementById("busca");
const seletorCategoria = document.getElementById("categoria");
const statusBusca = document.getElementById("status");
const modalOverlay = document.getElementById("modalOverlay");
const modalFechar = document.getElementById("modalFechar");
const modalImagem = document.getElementById("modalImagem");
const modalBtnAlternar = document.getElementById("modalBtnAlternar");
const modalDots = document.getElementById("modalDots");
const modalCategoria = document.getElementById("modalCategoria");
const modalNome = document.getElementById("modalNome");
const modalDescricao = document.getElementById("modalDescricao");
const modalPreco = document.getElementById("modalPreco");
let catalogo = [];
let modalFotos = [];
let modalIndice = 0;
async function carregarProdutos() {
    const resposta = await fetch("data/products.json");
    if (!resposta.ok) {
        throw new Error(`Falha ao carregar catálogo: ${resposta.status}`);
    }
    return resposta.json();
}
function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function popularCategorias(produtos) {
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
function criarCardProduto(produto) {
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
        const fotos = [produto.imagem, produto.imagemCostas];
        const imagemEl = card.querySelector(".produto-imagem");
        const botaoAlternar = card.querySelector(".btn-alternar-foto");
        const pontos = card.querySelectorAll(".dot");
        let indice = 0;
        botaoAlternar.addEventListener("click", (evento) => {
            evento.stopPropagation();
            indice = (indice + 1) % fotos.length;
            imagemEl.src = fotos[indice];
            pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indice));
        });
    }
    card.addEventListener("click", () => abrirModal(produto));
    return card;
}
function atualizarFotoModal() {
    modalImagem.src = modalFotos[modalIndice];
    const pontos = modalDots.querySelectorAll(".dot");
    pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === modalIndice));
}
function abrirModal(produto) {
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
function fecharModal() {
    modalOverlay.hidden = true;
}
modalFechar.addEventListener("click", fecharModal);
modalOverlay.addEventListener("click", (evento) => {
    if (evento.target === modalOverlay) {
        fecharModal();
    }
});
modalBtnAlternar.addEventListener("click", () => {
    modalIndice = (modalIndice + 1) % modalFotos.length;
    atualizarFotoModal();
});
document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !modalOverlay.hidden) {
        fecharModal();
    }
});
function renderizarProdutos(lista) {
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
function aplicarFiltros() {
    const termo = campoBusca.value.trim().toLowerCase();
    const categoria = seletorCategoria.value;
    const filtrado = catalogo.filter((produto) => {
        const bateCategoria = categoria === "todas" || produto.categoria === categoria;
        const bateBusca = produto.nome.toLowerCase().includes(termo);
        return bateCategoria && bateBusca;
    });
    renderizarProdutos(filtrado);
}
async function iniciar() {
    try {
        catalogo = await carregarProdutos();
        popularCategorias(catalogo);
        renderizarProdutos(catalogo);
    }
    catch (erro) {
        containerProdutos.innerHTML = `<p class="erro">Não foi possível carregar os produtos agora.</p>`;
        statusBusca.textContent = "Erro ao carregar produtos.";
        console.error(erro);
    }
}
campoBusca.addEventListener("input", aplicarFiltros);
seletorCategoria.addEventListener("change", aplicarFiltros);
iniciar();
//# sourceMappingURL=app.js.map