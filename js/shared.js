"use strict";
async function carregarProdutos(caminho = "data/products.json") {
    const resposta = await fetch(caminho);
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
//# sourceMappingURL=shared.js.map