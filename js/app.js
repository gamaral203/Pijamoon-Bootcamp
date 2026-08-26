"use strict";
const containerProdutos = document.getElementById("produtos");
const campoBusca = document.getElementById("busca");
const statusBusca = document.getElementById("status");
const heroSlides = document.getElementById("heroSlides");
const heroDots = document.getElementById("heroDots");
const heroBtnAnterior = document.getElementById("heroBtnAnterior");
const heroBtnProxima = document.getElementById("heroBtnProxima");
const categoriasDropdown = document.getElementById("categoriasDropdown");
const categoriasTrigger = document.getElementById("categoriasTrigger");
const categoriasMenu = document.getElementById("categoriasMenu");
const modalOverlay = document.getElementById("modalOverlay");
const modalFechar = document.getElementById("modalFechar");
const modalImagem = document.getElementById("modalImagem");
const modalBtnAnterior = document.getElementById("modalBtnAnterior");
const modalBtnProxima = document.getElementById("modalBtnProxima");
const modalDots = document.getElementById("modalDots");
const modalCategoria = document.getElementById("modalCategoria");
const modalNome = document.getElementById("modalNome");
const modalDescricao = document.getElementById("modalDescricao");
const modalPreco = document.getElementById("modalPreco");
let catalogo = [];
let categoriaAtual = "todas";
let modalFotos = [];
let modalIndice = 0;
let heroIndice = 0;
let heroTimer;
function irParaSlideHero(indice) {
    const slides = heroSlides.querySelectorAll(".hero-slide");
    const dots = heroDots.querySelectorAll(".dot");
    if (slides.length === 0)
        return;
    heroIndice = (indice + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("ativo", i === heroIndice));
    dots.forEach((dot, i) => dot.classList.toggle("ativo", i === heroIndice));
}
function pararAutoplayHero() {
    if (heroTimer !== undefined) {
        window.clearInterval(heroTimer);
        heroTimer = undefined;
    }
}
function iniciarAutoplayHero() {
    pararAutoplayHero();
    const prefereReduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefereReduzirMovimento)
        return;
    heroTimer = window.setInterval(() => irParaSlideHero(heroIndice + 1), 5000);
}
function mudarSlideHero(delta) {
    irParaSlideHero(heroIndice + delta);
    iniciarAutoplayHero();
}
function renderizarHero(produtos) {
    if (produtos.length === 0)
        return;
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
heroDots.addEventListener("click", (evento) => {
    const alvo = evento.target;
    if (!alvo.classList.contains("dot"))
        return;
    const dots = Array.from(heroDots.querySelectorAll(".dot"));
    const indice = dots.indexOf(alvo);
    if (indice >= 0) {
        irParaSlideHero(indice);
        iniciarAutoplayHero();
    }
});
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
function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function fecharDropdownCategorias() {
    categoriasMenu.classList.remove("aberto");
    categoriasTrigger.setAttribute("aria-expanded", "false");
}
function selecionarCategoria(categoria) {
    categoriaAtual = categoria;
    const botoes = categoriasMenu.querySelectorAll(".categoria-link");
    botoes.forEach((botao) => botao.classList.toggle("ativo", botao.dataset.categoria === categoria));
    fecharDropdownCategorias();
    aplicarFiltros();
}
function popularCategorias(produtos) {
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
    categoriasMenu.querySelectorAll(".categoria-link").forEach((botao) => {
        botao.addEventListener("click", () => selecionarCategoria(botao.dataset.categoria));
    });
}
categoriasTrigger.addEventListener("click", () => {
    const aberto = categoriasMenu.classList.toggle("aberto");
    categoriasTrigger.setAttribute("aria-expanded", String(aberto));
});
document.addEventListener("click", (evento) => {
    if (!categoriasDropdown.contains(evento.target)) {
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
function criarCardProduto(produto) {
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
        const fotos = [produto.imagem, produto.imagemCostas];
        const imagemEl = card.querySelector(".produto-imagem");
        const botaoAnterior = card.querySelector(".btn-anterior");
        const botaoProxima = card.querySelector(".btn-proxima");
        const pontos = card.querySelectorAll(".dot");
        let indice = 0;
        function mudarFoto(delta) {
            indice = (indice + delta + fotos.length) % fotos.length;
            imagemEl.src = fotos[indice];
            pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indice));
        }
        botaoAnterior.addEventListener("click", (evento) => {
            evento.stopPropagation();
            mudarFoto(-1);
        });
        botaoProxima.addEventListener("click", (evento) => {
            evento.stopPropagation();
            mudarFoto(1);
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
function fecharModal() {
    modalOverlay.hidden = true;
}
modalFechar.addEventListener("click", fecharModal);
modalOverlay.addEventListener("click", (evento) => {
    if (evento.target === modalOverlay) {
        fecharModal();
    }
});
function mudarFotoModal(delta) {
    modalIndice = (modalIndice + delta + modalFotos.length) % modalFotos.length;
    atualizarFotoModal();
}
modalBtnAnterior.addEventListener("click", () => mudarFotoModal(-1));
modalBtnProxima.addEventListener("click", () => mudarFotoModal(1));
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
    const filtrado = catalogo.filter((produto) => {
        const bateCategoria = categoriaAtual === "todas" || produto.categoria === categoriaAtual;
        const bateBusca = produto.nome.toLowerCase().includes(termo);
        return bateCategoria && bateBusca;
    });
    renderizarProdutos(filtrado);
}
async function iniciar() {
    try {
        catalogo = await carregarProdutos();
        renderizarHero(catalogo);
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
iniciar();
//# sourceMappingURL=app.js.map