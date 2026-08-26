interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagem: string;
  imagemCostas?: string;
  focoHero?: number;
  tamanhos?: string[];
}

async function carregarProdutos(caminho: string = "data/products.json"): Promise<Produto[]> {
  const resposta = await fetch(caminho);
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
