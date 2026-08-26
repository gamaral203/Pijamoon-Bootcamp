# Pijamoon — Desafio Bootcamp "Minha Loja no Ar"

Notas de alinhamento entre Gabriel e Claude. Se a conversa for perdida (troca de PC, chat novo), cole este arquivo no chat novo para retomar o contexto.

## O desafio (resumo)

- Entrega: uma URL pública com a loja funcionando + página `/como-fiz` com vídeo (5-8 min).
- Prazo: terça-feira 01/09/2026, 17h59.
- Individual. Depois da entrega: call de 10 min com 2-3 perguntas sobre o código.

### Requisitos obrigatórios
- Tema/identidade próprios (✅ já definidos — ver abaixo).
- Catálogo em `products.json` (mín. 6 produtos), carregado via `fetch`. **Proibido hardcodar produto no HTML.**
- Busca OU filtro por categoria funcionando.
- Site estático.
- Hospedado de graça (GitHub Pages, Netlify, Vercel ou Cloudflare Pages).
- Página `/como-fiz` com vídeo respondendo, na ordem: (1) organização do código, (2) por que o catálogo é separado do front / headless commerce, (3) mapeamento pra AWS + cache/CDN (browser → CDN → origem), (4) Lighthouse rodado ao vivo, (5) onde plugaria IA + o que foi mais difícil.

### Avaliação
Clareza da explicação (30) · Domínio técnico (25) · Loja no ar (20) · Lighthouse comentado (15) · Conexão com os workshops (10).

### Bônus (não fazer agora — escopo básico primeiro)
- Vídeo auto-hospedado (+10)
- Diagrama de arquitetura com BFF para app mobile (+10)
- Carrinho, checkout fictício, dark mode

## Decisões já tomadas

- **Sem framework.** TypeScript é permitido (compila para JS puro via `tsc`, sem bundler). Justificativa: nota é pela explicação, não pelo stack; vanilla/TS é mais fácil de defender linha por linha numa call.
- **Catálogo em `products.json` real, sem banco de dados.** Foi cogitado usar banco real (professor teria liberado verbalmente), mas decidimos seguir o que está escrito no documento oficial do desafio para não arriscar os 20 pontos do critério "Loja no ar". Se Gabriel confirmar a exceção por escrito com o professor, reavaliar.
- **Não usar os outros projetos Pijamoon como referência** (`pijamoon-catalogo`, `pijamoon`, `pijamoon-react` — repositórios reais e distintos do Gabriel). Este projeto é isolado, construído do zero.
- **Escopo evoluiu além do básico (atualizado 25/08).** O plano original era "básico primeiro, sem carrinho/checkout/extras", mas ao longo do desenvolvimento Gabriel pediu e foram adicionados: modal de detalhes do produto (foto ampliada + descrição completa), navegação entre foto de frente/costas, dropdown de categorias no cabeçalho, e ícones decorativos de conta/carrinho (sem função ainda — pensados como base pro checkout, que ele quer fazer depois). Carrinho/checkout de verdade continuam para depois, não são item pontuado no PDF oficial.
- **Produtos:** catálogo com 6 pijamas reais (fotos de frente e costas cada). Categorias são por **tipo de corte da peça** (não mais frio/calor): `alcinha`, `americano`, `calça`, `camisa`, `camisola` — batem com os nomes dos arquivos de foto que Gabriel enviou.
- **Identidade visual definida:** logo/hero real já enviado por Gabriel — ilustração de uma lua crescente com rosto dormindo sobre nuvens, estrelas douradas, pantufas, máscara de dormir e xícara de chocolate quente. Clima aconchegante/noturno/sonhador.
  - Paleta aproximada: azul lavanda `#9AAFCC`–`#B8C7E0` (céu), dourado/creme `#E8C878`–`#F0D9A0` (estrelas/lua), branco `#F5F5F2` (nuvens), azul petróleo escuro `#3B5478` (logotipo/texto).
  - Tipografia: serifada elegante no logotipo (estilo Playfair Display/Cormorant); sem serifa simples no resto do site.
- **Git:** commits frequentes a cada etapa relevante (não um commit único no final), seguindo Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.). Branch principal: `main`. Repositório remoto: https://github.com/gamaral203/Pijamoon-Bootcamp (conectado e com push em 25/08/2026).

## Modo de trabalho (importante) — ATUALIZADO 25/08

**Claude escreve o código** (HTML, TS/JS, CSS, `products.json`), explicando cada decisão à medida que escreve. **Gabriel valida** — lê, entende, pode pedir mudanças, e precisa reter o suficiente pra explicar e defender no vídeo e na call individual (isso é o "degrau 4" que o PDF do desafio permite: "a IA pode escrever o código com você, mas você precisa ser capaz de explicar e defender cada decisão").

Na prática: depois de cada trecho/arquivo relevante, Claude explica o "porquê" (não só o "o quê") — especialmente nos pontos que caem nas 5 perguntas do vídeo (organização do código, separação catálogo/front, mapeamento AWS/cache, Lighthouse, onde entraria IA). Se Gabriel não entender uma decisão, reexplicar antes de seguir — não vale ele repetir de cor sem entender.

## Estrutura de pastas (confirmada e em uso)

```
PijamoonBootCamp/
├── index.html            ← vitrine (Claude escreve, Gabriel valida)
├── css/style.css
├── ts/app.ts             ← fonte TypeScript
├── js/app.js             ← gerado pelo tsc, não editar à mão
├── data/products.json    ← catálogo (6 produtos)
├── img/produtos/         ← fotos de frente e costas de cada produto
├── como-fiz/index.html   ← vídeo ainda não embutido (iframe vazio)
├── tsconfig.json
└── package.json
```

## Ritmo de trabalho

**Sem cronograma dia-a-dia.** O PDF sugere um turno por dia (27/08 a 01/09), mas Gabriel decidiu ignorar essa divisão e avançar no próprio ritmo. Único prazo que importa de verdade: **terça 01/09, 17h59** (entrega final). Claude não deve empurrar ritmo/cronograma nas sugestões.

Nome/tema/produtos já escolhidos: **Pijamoon** — pijamas, identidade lua/nuvens/aconchego (ver logo acima). Atende ao requisito de "diferente dos exemplos de aula".

## As 5 perguntas do vídeo (ordem obrigatória, do PDF)

1. O que você construiu e como o código está organizado? (passear pelos arquivos)
2. Por que o catálogo é separado do front? (mostrar `products.json` + `fetch`, ligar com "headless commerce")
3. Se essa loja fosse pra AWS, onde entraria cada peça? Explicar cache/CDN: navegador → CDN → origem, e o que acontece com 10 mil acessos simultâneos.
4. Rodar o Lighthouse ao vivo (F12 → Lighthouse → Analyze) e comentar os scores — o que melhoraria primeiro e por quê.
5. Onde você plugaria IA nessa loja (busca? recomendação? atendimento?) — e o que foi mais difícil de verdade.

## Status atual (25/08)

**Feito:** esqueleto do projeto, `products.json` com 6 produtos reais (fotos comprimidas ~840KB total), vitrine com fetch + busca + filtro por categoria (dropdown no cabeçalho), modal de detalhes do produto com navegação de fotos, logo em SVG, identidade visual aplicada, tudo commitado e pushado no GitHub (branch `main`).

**Decisão explícita do Gabriel (25/08): hospedagem pública fica pra depois**, quando o resto estiver pronto — ele avalia que não é difícil e prefere continuar iterando na loja antes. Risco assumido conscientemente: só descobrir problemas de hospedagem/fetch-hospedado perto do prazo. Claude não deve insistir nisso de novo a menos que o prazo (01/09 17h59) esteja se aproximando perigosamente.

**Ainda falta (obrigatório):** publicar a loja (GitHub Pages ou similar), testar em celular de verdade, rodar Lighthouse, gravar o vídeo e montar `/como-fiz`.

**Bônus considerados:** diagrama de arquitetura com BFF (+10, conceito já explicado a Gabriel — ver seção do desafio), vídeo auto-hospedado (+10, decisão pendente).
