/**
 * shared.ts — código que TODAS as páginas usam.
 *
 * Este arquivo não tem import/export porque o projeto não usa bundler nem
 * módulos: cada página HTML carrega este script ANTES do seu próprio script
 * de página (app.ts, produto.ts, login.ts, carrinho.ts, checkout.ts), via
 * duas tags <script> em sequência. Como os dois rodam no mesmo escopo global
 * do navegador, tudo que é declarado aqui (a interface Produto, as funções)
 * fica disponível pro script da página seguinte usar direto, sem precisar
 * importar nada.
 *
 * Se você abrir qualquer outro .ts e ver uma função sendo chamada sem estar
 * declarada naquele arquivo, ela provavelmente está aqui.
 */

/** Formato de um produto no catálogo (tabela "produtos" no Supabase). */
interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao: string;
  imagem: string;
  /** Foto de costas — nem todo produto tem, por isso o "?" (opcional). */
  imagemCostas?: string;
  /** Ponto de foco vertical (0 a 100) usado só no carrossel do hero — ver ts/app.ts. */
  focoHero?: number;
  /** Tamanhos disponíveis (ex: ["P","M","G","GG"]) — usado na página de produto. */
  tamanhos?: string[];
}

/**
 * Catálogo migrado de data/products.json pra uma tabela no Supabase
 * (ver supabase/schema.sql pro SQL que cria a tabela e insere os produtos).
 *
 * "supabase" (minúsculo, sem tipo) é o objeto global que o script do
 * Supabase (carregado via CDN, ver a tag <script> antes de shared.js em
 * cada página HTML) expõe em window.supabase. Como o projeto não instala o
 * pacote @supabase/supabase-js via npm (isso puxaria um bundler junto), não
 * tem os tipos oficiais — daí o "declare const ... any" abaixo, só pra
 * avisar o TypeScript "essa variável existe em tempo de execução, confia".
 */
declare const supabase: { createClient: (url: string, chave: string) => any };

const SUPABASE_URL = "https://jrnfwkdfmwahfjeokmsg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iFNonCbS9HqC6xOTpAhrCA_aXKsCZ9A";

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Busca o catálogo inteiro na tabela "produtos" do Supabase. As colunas do
 * banco usam snake_case (convenção do Postgres: imagem_costas, foco_hero),
 * então aqui a gente "traduz" cada linha pro formato camelCase que o resto
 * do código (interface Produto) espera — assim nenhum outro arquivo
 * (app.ts, produto.ts, carrinho.ts, checkout.ts) precisou mudar uma linha
 * sequer: pra eles, continua sendo só "uma lista de Produto".
 */
async function carregarProdutos(): Promise<Produto[]> {
  const { data, error } = await clienteSupabase.from("produtos").select("*");

  if (error) {
    throw new Error(`Falha ao carregar catálogo: ${error.message}`);
  }

  return (data ?? []).map((linha: Record<string, unknown>): Produto => ({
    id: linha.id as string,
    nome: linha.nome as string,
    categoria: linha.categoria as string,
    preco: linha.preco as number,
    descricao: linha.descricao as string,
    imagem: linha.imagem as string,
    imagemCostas: (linha.imagem_costas as string) ?? undefined,
    focoHero: (linha.foco_hero as number) ?? undefined,
    tamanhos: (linha.tamanhos as string[]) ?? undefined,
  }));
}

/** Formata um número em Real: 89.9 → "R$ 89,90". */
function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Deixa a primeira letra maiúscula: "alcinha" → "Alcinha". Usado nas categorias. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ============================================================
 * Usuário e carrinho
 * ============================================================
 * Login e carrinho são só simulados no navegador (localStorage) — este é um
 * site estático, sem servidor nem banco de dados de verdade. Numa loja real,
 * isso seria um serviço de autenticação (Cognito/Auth0/Firebase) e um
 * carrinho persistido no backend, não no localStorage do visitante.
 * ============================================================ */

interface Usuario {
  nome: string;
  email: string;
}

/** Um item guardado no carrinho: qual produto, em qual tamanho, quantos. */
interface ItemCarrinho {
  produtoId: string;
  tamanho: string;
  quantidade: number;
}

/** Chaves usadas no localStorage do navegador — nomes prefixados "pijamoon_"
 *  pra não colidir com nada de outro site guardado no mesmo navegador. */
const CHAVE_USUARIO = "pijamoon_usuario";
const CHAVE_CARRINHO = "pijamoon_carrinho";

/** Lê o usuário logado do localStorage, ou null se ninguém estiver logado. */
function obterUsuario(): Usuario | null {
  const bruto = localStorage.getItem(CHAVE_USUARIO);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Usuario;
  } catch {
    // localStorage corrompido/editado à mão — trata como "não logado" em vez de quebrar a página
    return null;
  }
}

/** Salva {nome, email} no localStorage — chamado pelo formulário de login. */
function salvarUsuario(usuario: Usuario): void {
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

/** Apaga o usuário salvo — "logout". */
function sairUsuario(): void {
  localStorage.removeItem(CHAVE_USUARIO);
}

/** Lê a lista de itens do carrinho, ou array vazio se não tiver nada salvo. */
function obterCarrinho(): ItemCarrinho[] {
  const bruto = localStorage.getItem(CHAVE_CARRINHO);
  if (!bruto) return [];
  try {
    return JSON.parse(bruto) as ItemCarrinho[];
  } catch {
    return [];
  }
}

/** Sobrescreve o carrinho inteiro no localStorage com a lista dada. */
function salvarCarrinho(itens: ItemCarrinho[]): void {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
}

/**
 * Adiciona um produto ao carrinho. Se o mesmo produto+tamanho já estiver lá
 * (ex: usuário volta na mesma peça e clica "adicionar" de novo), soma a
 * quantidade em vez de criar uma linha duplicada.
 */
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

/** Soma a quantidade de todos os itens — é o número que aparece no badge do carrinho. */
function contarItensCarrinho(): number {
  return obterCarrinho().reduce((total, item) => total + item.quantidade, 0);
}

/**
 * Atualiza o ícone de conta (entrar/sair), o nome ao lado dele, o número no
 * ícone de carrinho, e o botão de tema — tudo no cabeçalho. Chamada no
 * início de toda página que tem esses elementos (ver o "iniciar"/"iniciarX"
 * de cada script de página).
 *
 * "raiz" é o prefixo relativo pra voltar até a raiz do site: vazio na home
 * (index.html), "../" nas páginas de um nível abaixo (produto/, login/,
 * carrinho/, checkout/) — é assim que um mesmo botão "Entrar" sabe navegar
 * pra "login/index.html" estando na home, ou "../login/index.html" estando
 * dentro de produto/index.html.
 */
function atualizarHeaderConta(raiz: string = ""): void {
  const botaoConta = document.getElementById("botaoConta") as HTMLButtonElement | null;
  const contaNome = document.getElementById("contaNome") as HTMLSpanElement | null;
  const badgeCarrinho = document.getElementById("badgeCarrinho") as HTMLSpanElement | null;

  if (botaoConta) {
    const usuario = obterUsuario();

    if (usuario) {
      // logado: o botão de "entrar" vira "sair", mostra o primeiro nome,
      // e o clique passa a deslogar em vez de ir pra tela de login
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
      // deslogado: botão volta a ser "entrar" e leva pra tela de login
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
    // esconde a bolinha do badge quando o carrinho está vazio, em vez de mostrar "0"
    badgeCarrinho.hidden = total === 0;
  }

  atualizarBotaoTema();
}

/* ============================================================
 * Modo escuro
 * ============================================================
 * Alternável por um botão no cabeçalho e salvo no localStorage. O <head> de
 * cada página já aplica o tema salvo antes do CSS carregar (um scriptzinho
 * inline, pra evitar o "flash" de tema claro que trocaria pra escuro um
 * instante depois) — aqui só cuidamos do botão em si e da troca em tempo
 * real. As cores de cada tema ficam no css/style.css, em variáveis CSS que
 * mudam de valor conforme o atributo data-tema no <html>.
 * ============================================================ */

const CHAVE_TEMA = "pijamoon_tema";

/** Ícone de lua — mostrado quando o tema ATUAL é claro (clique troca pra escuro). */
const ICONE_LUA = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
  </svg>
`;

/** Ícone de sol — mostrado quando o tema ATUAL é escuro (clique troca pra claro). */
const ICONE_SOL = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
`;

/** Lê o tema salvo no localStorage ("escuro" ou "claro", padrão claro). */
function temaAtual(): string {
  return localStorage.getItem(CHAVE_TEMA) === "escuro" ? "escuro" : "claro";
}

/**
 * Aplica um tema: seta o atributo data-tema no <html> (é isso que o CSS lê
 * pra trocar as variáveis de cor — ver :root[data-tema="escuro"] no
 * style.css), salva a escolha, e atualiza o ícone do botão.
 */
function aplicarTema(tema: string): void {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CHAVE_TEMA, tema);
  atualizarBotaoTema();
}

/** Troca claro↔escuro. Chamada quando o usuário clica no botão de tema. */
function alternarTema(): void {
  aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro");
}

/** Atualiza o ícone/tooltip do botão de tema pra refletir o tema atual, e liga o clique nele. */
function atualizarBotaoTema(): void {
  const botaoTema = document.getElementById("botaoTema") as HTMLButtonElement | null;
  if (!botaoTema) return;

  const escuro = temaAtual() === "escuro";
  botaoTema.innerHTML = escuro ? ICONE_SOL : ICONE_LUA;
  botaoTema.title = escuro ? "Modo claro" : "Modo escuro";
  botaoTema.setAttribute("aria-label", botaoTema.title);
  botaoTema.onclick = alternarTema;
}
