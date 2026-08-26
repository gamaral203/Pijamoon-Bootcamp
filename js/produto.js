"use strict";
(function () {
    const RAIZ = "../";
    const breadcrumb = document.getElementById("breadcrumb");
    const detalheConteudo = document.getElementById("detalheConteudo");
    const detalheErro = document.getElementById("detalheErro");
    const detalheImagem = document.getElementById("detalheImagem");
    const detalheBtnAnterior = document.getElementById("detalheBtnAnterior");
    const detalheBtnProxima = document.getElementById("detalheBtnProxima");
    const detalheDots = document.getElementById("detalheDots");
    const detalheCategoria = document.getElementById("detalheCategoria");
    const detalheNome = document.getElementById("detalheNome");
    const detalhePreco = document.getElementById("detalhePreco");
    const detalheTamanhos = document.getElementById("detalheTamanhos");
    const detalheDescricao = document.getElementById("detalheDescricao");
    const qtdValor = document.getElementById("qtdValor");
    const qtdMenos = document.getElementById("qtdMenos");
    const qtdMais = document.getElementById("qtdMais");
    const botaoAdicionar = document.getElementById("botaoAdicionar");
    const botaoComprarAgora = document.getElementById("botaoComprarAgora");
    let fotos = [];
    let indiceFoto = 0;
    let quantidade = 1;
    let produtoAtual = null;
    function atualizarFoto() {
        detalheImagem.src = fotos[indiceFoto];
        const pontos = detalheDots.querySelectorAll(".dot");
        pontos.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indiceFoto));
    }
    function mudarFoto(delta) {
        indiceFoto = (indiceFoto + delta + fotos.length) % fotos.length;
        atualizarFoto();
    }
    detalheBtnAnterior.addEventListener("click", () => mudarFoto(-1));
    detalheBtnProxima.addEventListener("click", () => mudarFoto(1));
    function renderizarTamanhos(tamanhos) {
        detalheTamanhos.innerHTML = (tamanhos ?? [])
            .map((tamanho, i) => `<button type="button" class="tamanho-opcao${i === 0 ? " selecionado" : ""}" data-tamanho="${tamanho}">${tamanho}</button>`)
            .join("");
    }
    detalheTamanhos.addEventListener("click", (evento) => {
        const alvo = evento.target;
        if (!alvo.classList.contains("tamanho-opcao"))
            return;
        detalheTamanhos.querySelectorAll(".tamanho-opcao").forEach((botao) => {
            botao.classList.toggle("selecionado", botao === alvo);
        });
    });
    function atualizarQuantidade() {
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
    function guardarProdutoAtualNoCarrinho() {
        if (!produtoAtual)
            return;
        const tamanhoSelecionado = detalheTamanhos.querySelector(".tamanho-opcao.selecionado");
        const tamanho = tamanhoSelecionado?.dataset.tamanho ?? "único";
        adicionarAoCarrinho(produtoAtual.id, tamanho, quantidade);
        atualizarHeaderConta(RAIZ);
    }
    botaoAdicionar.addEventListener("click", () => {
        guardarProdutoAtualNoCarrinho();
        const textoOriginal = botaoAdicionar.textContent;
        botaoAdicionar.textContent = "Adicionado ✓";
        botaoAdicionar.disabled = true;
        window.setTimeout(() => {
            botaoAdicionar.textContent = textoOriginal;
            botaoAdicionar.disabled = false;
        }, 1200);
    });
    botaoComprarAgora.addEventListener("click", () => {
        guardarProdutoAtualNoCarrinho();
        window.location.href = `${RAIZ}carrinho/index.html`;
    });
    function renderizarProduto(produto) {
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
    function mostrarErro() {
        detalheConteudo.hidden = true;
        detalheErro.hidden = false;
    }
    async function iniciarPaginaProduto() {
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
        }
        catch (erro) {
            mostrarErro();
            console.error(erro);
        }
    }
    iniciarPaginaProduto();
})();
//# sourceMappingURL=produto.js.map