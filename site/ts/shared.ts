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

/** Formato de um produto no catálogo (o que GET /api/products devolve). */
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
 * Busca o catálogo inteiro na API da loja (GET /api/products), servida pelo
 * mesmo domínio do site: Amplify (regra /api/*) → API Gateway → Lambda → DynamoDB. A API
 * já devolve cada item no formato da interface Produto, então nenhum outro
 * arquivo (app.ts, produto.ts, carrinho.ts, checkout.ts) precisou mudar.
 */
async function carregarProdutos(): Promise<Produto[]> {
  const resposta = await fetch("/api/products");

  if (!resposta.ok) {
    throw new Error(`Falha ao carregar catálogo: ${resposta.status}`);
  }

  return resposta.json();
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
 * Login com Amazon Cognito: a "sessão" guardada no navegador são os tokens
 * que o Cognito entregou no login (ver ts/auth.ts, que conversa com ele).
 * O nome e o e-mail do usuário são lidos de dentro do ID token, que é um
 * JWT: um JSON assinado, que qualquer um consegue LER, mas ninguém consegue
 * ALTERAR sem invalidar a assinatura (quem confere é o API Gateway).
 *
 * O carrinho continua no localStorage do visitante (carrinho no back-end é
 * um extra do roadmap).
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

/** Os tokens que o Cognito entrega no login. */
interface Sessao {
  /** JWT com quem é o usuário (sub, email, name); vence em 1 hora. */
  idToken: string;
  /** Serve para pedir um ID token novo sem a senha; vence em 30 dias. */
  refreshToken: string;
}

/** Chaves usadas no localStorage do navegador — nomes prefixados "pijamoon_"
 *  pra não colidir com nada de outro site guardado no mesmo navegador. */
const CHAVE_SESSAO = "pijamoon_sessao";
const CHAVE_CARRINHO = "pijamoon_carrinho";
/** Chave do login simulado antigo: só é apagada, para não sobrar lixo. */
const CHAVE_USUARIO_ANTIGA = "pijamoon_usuario";

/**
 * Lê o conteúdo (as "claims") de um JWT. O token tem três partes separadas
 * por ponto (cabeçalho.conteúdo.assinatura), e o conteúdo é um JSON em
 * Base64URL. Isto só LÊ o token: quem confere a assinatura é o API Gateway.
 */
function lerClaimsDoToken(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)); // TextDecoder: acentos do nome em UTF-8
  } catch {
    return null;
  }
}

/** Lê a sessão salva, ou null se ninguém estiver logado. */
function obterSessao(): Sessao | null {
  const bruto = localStorage.getItem(CHAVE_SESSAO);
  if (!bruto) return null;
  try {
    const sessao = JSON.parse(bruto) as Sessao;
    return sessao.idToken && sessao.refreshToken ? sessao : null;
  } catch {
    // localStorage corrompido/editado à mão — trata como "não logado" em vez de quebrar a página
    return null;
  }
}

/** Salva os tokens do Cognito — chamado depois do login (ts/auth.ts). */
function salvarSessao(sessao: Sessao): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  localStorage.removeItem(CHAVE_USUARIO_ANTIGA);
}

/**
 * O usuário logado, lido do ID token, ou null. Mesmo com o ID token vencido,
 * a pessoa continua logada enquanto houver refresh token: o token novo é
 * pedido na hora de chamar a API (ver obterTokenValido em ts/auth.ts).
 */
function obterUsuario(): Usuario | null {
  const sessao = obterSessao();
  const claims = sessao && lerClaimsDoToken(sessao.idToken);
  if (!claims || typeof claims.email !== "string") return null;
  return { nome: typeof claims.name === "string" ? claims.name : claims.email, email: claims.email };
}

/** "Logout": apaga os tokens do navegador. */
function sairUsuario(): void {
  localStorage.removeItem(CHAVE_SESSAO);
  localStorage.removeItem(CHAVE_USUARIO_ANTIGA);
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
      mostrarLinkPedidos(raiz, true);
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
      mostrarLinkPedidos(raiz, false);
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

/**
 * Mostra (ou esconde) o ícone "Meus pedidos" no cabeçalho, ao lado do nome.
 * Ele é criado por código, e não escrito em cada HTML, porque só existe
 * para quem está logado.
 */
function mostrarLinkPedidos(raiz: string, visivel: boolean): void {
  let link = document.getElementById("linkPedidos") as HTMLAnchorElement | null;
  if (!visivel) {
    link?.remove();
    return;
  }
  if (link) return;

  const contaNome = document.getElementById("contaNome");
  if (!contaNome) return;
  link = document.createElement("a");
  link.id = "linkPedidos";
  link.className = "icone-header";
  link.href = `${raiz}pedidos/index.html`;
  link.title = "Meus pedidos";
  link.setAttribute("aria-label", "Meus pedidos");
  // ícone de "recibo": uma folha com linhas
  link.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>';
  if (window.location.pathname.includes("/pedidos/")) link.classList.add("ativo");
  contaNome.after(link);
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
