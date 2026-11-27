/**
 * carrinho-sync.ts — sincroniza o carrinho do navegador com o servidor (extra).
 *
 * Sem login, nada muda: o carrinho vive só no localStorage. Logado, ele
 * também fica salvo no servidor (GET e PUT /api/cart), e acompanha a pessoa
 * em qualquer aparelho:
 *
 *   ao abrir uma página  → busca o carrinho do servidor
 *                          · logo depois do login: MESCLA com o do navegador
 *                            (soma as quantidades) e salva o resultado
 *                          · servidor sem carrinho: envia o do navegador
 *                          · nos outros casos: o do servidor vale
 *   a cada mudança       → envia a lista inteira, com um atraso de 0,8 s
 *                          (debounce): vários cliques viram uma requisição
 *
 * Precisa de js/config.js, js/shared.js e js/auth.js carregados antes.
 */

/** Marcado pelo login (ts/auth.ts): na próxima página, mesclar os carrinhos. */
const CHAVE_MESCLAR_CARRINHO = "pijamoon_mesclar_carrinho";

/** Atualiza só o número do ícone do carrinho no cabeçalho. */
function atualizarBadgeCarrinho(): void {
  const badge = document.getElementById("badgeCarrinho");
  if (!badge) return;
  const total = contarItensCarrinho();
  badge.textContent = String(total);
  badge.hidden = total === 0;
}

/** Junta dois carrinhos: o mesmo produto e tamanho somam as quantidades (até 10). */
function mesclarCarrinhos(a: ItemCarrinho[], b: ItemCarrinho[]): ItemCarrinho[] {
  const mapa = new Map<string, ItemCarrinho>();
  for (const item of [...a, ...b]) {
    const chave = `${item.produtoId}|${item.tamanho}`;
    const existente = mapa.get(chave);
    mapa.set(chave, existente ? { ...existente, quantidade: Math.min(10, existente.quantidade + item.quantidade) } : { ...item });
  }
  return [...mapa.values()].slice(0, 20);
}

/** Enquanto o carrinho do servidor é aplicado, as mudanças não voltam para ele. */
let aplicandoDoServidor = false;
let envioPendente: ReturnType<typeof setTimeout> | null = null;

async function enviarCarrinho(manterVivo = false): Promise<void> {
  const token = await obterTokenValido();
  if (!token) return;
  await fetch("/api/cart", {
    method: "PUT",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itens: obterCarrinho() }),
    keepalive: manterVivo, // deixa o envio terminar mesmo se a página fechar
  }).catch(() => {
    // falha de rede: o carrinho continua no navegador e vai na próxima mudança
  });
}

async function sincronizarComServidor(): Promise<void> {
  if (!obterUsuario()) return;
  try {
    const token = await obterTokenValido();
    if (!token) return;
    const resposta = await fetch("/api/cart", { headers: { Authorization: `Bearer ${token}` } });
    if (!resposta.ok) return;
    const servidor: { itens: ItemCarrinho[]; atualizadoEm: string | null } = await resposta.json();

    const local = obterCarrinho();
    const mesclar = localStorage.getItem(CHAVE_MESCLAR_CARRINHO) === "1";
    localStorage.removeItem(CHAVE_MESCLAR_CARRINHO);

    let final: ItemCarrinho[];
    let enviar = false;
    if (mesclar) {
      final = mesclarCarrinhos(servidor.itens, local);
      enviar = true;
    } else if (servidor.atualizadoEm === null) {
      final = local; // primeira vez com carrinho no servidor: leva o do navegador
      enviar = local.length > 0;
    } else {
      final = servidor.itens;
    }

    aplicandoDoServidor = true;
    salvarCarrinho(final);
    aplicandoDoServidor = false;
    atualizarBadgeCarrinho();
    if (enviar) await enviarCarrinho();
  } catch {
    // sem conexão: segue com o carrinho do navegador
  }
}

// Cada mudança no carrinho (ver salvarCarrinho em ts/shared.ts) agenda um envio.
window.addEventListener("pijamoon:carrinho-mudou", () => {
  if (aplicandoDoServidor || !obterUsuario()) return;
  if (envioPendente) clearTimeout(envioPendente);
  envioPendente = setTimeout(() => {
    envioPendente = null;
    enviarCarrinho();
  }, 800);
});

// Se a página fechar com um envio agendado, manda na hora.
window.addEventListener("pagehide", () => {
  if (!envioPendente) return;
  clearTimeout(envioPendente);
  envioPendente = null;
  enviarCarrinho(true);
});

/**
 * Termina quando o carrinho já veio do servidor. As páginas de carrinho e
 * checkout esperam por ela antes de desenhar, para não mostrar um carrinho
 * desatualizado logo depois do login.
 */
const carrinhoSincronizado: Promise<void> = sincronizarComServidor();
