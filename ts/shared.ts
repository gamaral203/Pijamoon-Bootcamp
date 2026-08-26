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

/**
 * Login e carrinho são só simulados no navegador (localStorage) — este é um
 * site estático, sem servidor nem banco de dados de verdade. Numa loja real,
 * isso seria um serviço de autenticação (Cognito/Auth0/Firebase) e um
 * carrinho persistido no backend, não no localStorage do visitante.
 */

interface Usuario {
  nome: string;
  email: string;
}

interface ItemCarrinho {
  produtoId: string;
  tamanho: string;
  quantidade: number;
}

const CHAVE_USUARIO = "pijamoon_usuario";
const CHAVE_CARRINHO = "pijamoon_carrinho";

function obterUsuario(): Usuario | null {
  const bruto = localStorage.getItem(CHAVE_USUARIO);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Usuario;
  } catch {
    return null;
  }
}

function salvarUsuario(usuario: Usuario): void {
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function sairUsuario(): void {
  localStorage.removeItem(CHAVE_USUARIO);
}

function obterCarrinho(): ItemCarrinho[] {
  const bruto = localStorage.getItem(CHAVE_CARRINHO);
  if (!bruto) return [];
  try {
    return JSON.parse(bruto) as ItemCarrinho[];
  } catch {
    return [];
  }
}

function salvarCarrinho(itens: ItemCarrinho[]): void {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
}

function adicionarAoCarrinho(produtoId: string, tamanho: string, quantidade: number): void {
  const itens = obterCarrinho();
  const existente = itens.find((item) => item.produtoId === produtoId && item.tamanho === tamanho);

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    itens.push({ produtoId, tamanho, quantidade });
  }

  salvarCarrinho(itens);
}

function contarItensCarrinho(): number {
  return obterCarrinho().reduce((total, item) => total + item.quantidade, 0);
}

/**
 * Atualiza o ícone de conta (entrar/sair) e o número no ícone de carrinho
 * do cabeçalho. Chamada em toda página que tem esses elementos.
 * "raiz" é o prefixo relativo pra voltar até a raiz do site
 * (vazio na home, "../" nas páginas de um nível abaixo).
 */
function atualizarHeaderConta(raiz: string = ""): void {
  const botaoConta = document.getElementById("botaoConta") as HTMLButtonElement | null;
  const contaNome = document.getElementById("contaNome") as HTMLSpanElement | null;
  const badgeCarrinho = document.getElementById("badgeCarrinho") as HTMLSpanElement | null;

  if (botaoConta) {
    const usuario = obterUsuario();

    if (usuario) {
      const primeiroNome = usuario.nome.split(" ")[0];
      botaoConta.title = `Sair (${primeiroNome})`;
      botaoConta.setAttribute("aria-label", `Sair (${primeiroNome})`);
      botaoConta.classList.add("logado");
      botaoConta.onclick = () => {
        sairUsuario();
        window.location.href = `${raiz}index.html`;
      };

      if (contaNome) {
        contaNome.textContent = primeiroNome;
        contaNome.hidden = false;
      }
    } else {
      botaoConta.title = "Entrar";
      botaoConta.setAttribute("aria-label", "Entrar");
      botaoConta.classList.remove("logado");
      botaoConta.onclick = () => {
        window.location.href = `${raiz}login/index.html`;
      };

      if (contaNome) {
        contaNome.textContent = "";
        contaNome.hidden = true;
      }
    }
  }

  if (badgeCarrinho) {
    const total = contarItensCarrinho();
    badgeCarrinho.textContent = String(total);
    badgeCarrinho.hidden = total === 0;
  }
}
