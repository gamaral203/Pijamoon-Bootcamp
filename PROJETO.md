# Pijamoon — Desafio Bootcamp "Minha Loja no Ar"

Notas de alinhamento entre Gabriel e Claude. Se a conversa for perdida (troca de PC, chat novo), cole este arquivo no chat novo para retomar o contexto.

## O desafio (resumo)

- Entrega: uma URL pública com a loja funcionando + página `/como-fiz` com vídeo (5-8 min).
- Prazo: terça-feira 01/09/2026, 17h59.
- Individual. Depois da entrega: call de 10 min com 2-3 perguntas sobre o código.

### Requisitos obrigatórios
- [x] Tema/identidade próprios — definidos (lua/nuvens/aconchego, ver abaixo).
- [x] Catálogo em `products.json` (mín. 6 produtos), carregado via `fetch`. **Proibido hardcodar produto no HTML.** — 6 produtos, sem hardcode.
- [x] Busca OU filtro por categoria funcionando — os dois implementados (busca por nome + dropdown de categoria).
- [x] Site estático — HTML/CSS/TS puro, sem framework nem bundler.
- [ ] Hospedado de graça (GitHub Pages, Netlify, Vercel ou Cloudflare Pages) — **pendente**, adiado de propósito (ver decisões).
- [ ] Página `/como-fiz` com vídeo respondendo, na ordem: (1) organização do código, (2) por que o catálogo é separado do front / headless commerce, (3) mapeamento pra AWS + cache/CDN (browser → CDN → origem), (4) Lighthouse rodado ao vivo, (5) onde plugaria IA + o que foi mais difícil. — **pendente**, página existe mas o iframe do vídeo está vazio; vídeo ainda não gravado.

### Avaliação
Clareza da explicação (30) · Domínio técnico (25) · Loja no ar (20) · Lighthouse comentado (15) · Conexão com os workshops (10).

### Bônus (não fazer agora — escopo básico primeiro)
- [ ] Vídeo auto-hospedado (+10) — decisão pendente.
- [ ] Diagrama de arquitetura com BFF para app mobile (+10) — conceito já explicado a Gabriel, diagrama ainda não feito.
- [ ] Carrinho, checkout fictício, dark mode — não iniciado (ícones de conta/carrinho no header são só placeholder visual, sem função).

## Decisões já tomadas

- **Sem framework.** TypeScript é permitido (compila para JS puro via `tsc`, sem bundler). Justificativa: nota é pela explicação, não pelo stack; vanilla/TS é mais fácil de defender linha por linha numa call.
- **Catálogo em `products.json` real, sem banco de dados.** Foi cogitado usar banco real (professor teria liberado verbalmente), mas decidimos seguir o que está escrito no documento oficial do desafio para não arriscar os 20 pontos do critério "Loja no ar". Se Gabriel confirmar a exceção por escrito com o professor, reavaliar.
- **Não usar os outros projetos Pijamoon como referência** (`pijamoon-catalogo`, `pijamoon`, `pijamoon-react` — repositórios reais e distintos do Gabriel). Este projeto é isolado, construído do zero.
- **Escopo evoluiu além do básico (atualizado 26/08).** O plano original era "básico primeiro, sem carrinho/checkout/extras", mas ao longo do desenvolvimento Gabriel pediu e foram adicionados: página de detalhes do produto com foto ampliada, descrição completa e tamanhos (P/M/G/GG), navegação entre foto de frente/costas, dropdown de categorias no cabeçalho, ícones decorativos de conta/carrinho (sem função ainda — pensados como base pro checkout, que ele quer fazer depois), carrossel de fotos no hero (autoplay, setas, dots, ponto de foco por foto via campo `focoHero` em `products.json`) e uma faixa de selos de confiança (frete/pagamento/segurança/suporte) entre o hero e a grade de produtos. Carrinho/checkout de verdade continuam para depois, não são item pontuado no PDF oficial.
- **Detalhe do produto é página própria, não modal (atualizado 26/08).** Começou como modal (popup por cima da vitrine), mas Gabriel pediu uma transição de página de verdade, tipo loja real. Virou `produto/index.html?id=...` — segue o mesmo padrão multi-página que já existia em `/como-fiz`. `ts/shared.ts` guarda o que os dois scripts (`app.ts` da vitrine e `produto.ts` da página de detalhe) precisam em comum (buscar catálogo, formatar preço, etc.), carregado antes de cada um via `<script>` — sem bundler, sem import/export, só ordem de carregamento.
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
├── produto/index.html    ← página de detalhes do produto (?id=...)
├── css/style.css
├── ts/shared.ts          ← Produto, carregarProdutos, formatarPreco, capitalizar
├── ts/app.ts             ← lógica da vitrine (hero, busca, filtro, grade)
├── ts/produto.ts         ← lógica da página de detalhes
├── js/                   ← gerado pelo tsc a partir de ts/, não editar à mão
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

## Status atual (26/08)

**Feito:** esqueleto do projeto, `products.json` com 6 produtos reais (fotos comprimidas ~840KB total), vitrine com fetch + busca + filtro por categoria (dropdown no cabeçalho), modal de detalhes do produto com navegação de fotos, logo em SVG, identidade visual aplicada, tudo commitado e pushado no GitHub (branch `main`).

**Responsividade mobile revisada (26/08):** testado com Playwright em 320-1280px, sem overflow horizontal em nenhuma largura. Ajustes feitos em `css/style.css`: grid de produtos em 2 colunas fixas até 640px (antes era 1 coluna), `font-size: 16px` no campo de busca em mobile (evita zoom automático do iOS Safari), áreas de toque maiores para botões (fechar modal, trocar foto, ícones do header), busca+categorias empilham verticalmente em telas ≤400px, padding/fontes do modal reduzidos pra mobile. De quebra, achado e corrigido um bug pré-existente: o menu de categorias tinha `left: 0` relativo ao botão e, sendo mais largo que ele, causava scroll horizontal fantasma em larguras entre 400-640px (ex. iPhone 11/XR, 414px) mesmo fechado — corrigido ancorando com `right: 0`.

**Carrossel de fotos no hero + faixa de confiança (26/08):** hero agora mostra as fotos dos 6 produtos em carrossel (setas, dots, autoplay a cada 5s que respeita `prefers-reduced-motion`, CTA "Ver coleção" com scroll suave até a grade). Fonte das imagens é o próprio `products.json` (sem duplicar caminho de foto) — reforça o argumento de "catálogo separado do front" pro vídeo. Abaixo do hero, uma faixa com 4 selos (frete, pagamento, segurança, suporte) na identidade visual da loja. Dois bugs reais encontrados e corrigidos durante os testes:
  - `aspect-ratio` + `max-height` juntos faziam o hero encolher de LARGURA em telas grandes (>1100px) em vez de ocupar a tela toda — trocado por `height: clamp()`.
  - O bloco de texto do hero (`.hero-conteudo`) tampava o clique nas setas por baixo, mesmo na área vazia sem texto — corrigido com `pointer-events: none` nele e `pointer-events: auto` só no botão CTA.
  - As fotos de frente das 6 fotos são retrato (900×1350) e o hero é bem mais largo que alto, então só uma faixa fina de cada foto fica visível; cada produto ganhou um campo `focoHero` (0-100, altura do corte) calibrado a dedo pra mostrar rosto + pijama juntos na maioria das fotos.

**Bug de catálogo corrigido (26/08):** as fotos de "Pijama Canela Aconchego" (regata caramelo) e "Pijama Laço de Lua" (camisa de laçinhos) estavam trocadas em `products.json` — cada produto mostrava a foto do outro. Não tinha relação com o carrossel; afetava a grade toda. Corrigido trocando os caminhos `imagem`/`imagemCostas` de volta pro produto certo.

**Modal virou página de produto de verdade (26/08):** o clique no card agora navega pra `produto/index.html?id=...` (mesmo padrão de página separada que `/como-fiz` já usava) em vez de abrir um popup por cima da vitrine. A página tem breadcrumb, galeria com frente/costas, tamanhos (P/M/G/GG, campo `tamanhos` no `products.json`), seletor de quantidade e botão "Comprar" desabilitado (mesmo motivo dos ícones de conta/carrinho — sem checkout ainda). Todo o código do modal foi removido; lógica compartilhada entre a vitrine e a página de produto ficou em `ts/shared.ts`. Dois bugs achados testando essa mudança:
  - `/como-fiz` reaproveitava a classe `.hero` que virou o carrossel — quebrou o hero de texto simples dessa página. Corrigido separando em `.hero` (texto simples, páginas secundárias) e `.hero-carrossel` (fotos, só na home).
  - A tela de "produto não encontrado" não escondia o layout por baixo: o atributo `hidden` do HTML e a regra `.produto-detalhe { display: flex }` têm a mesma especificidade CSS, e a regra vencia. Corrigido com `.produto-detalhe[hidden] { display: none }`.

**Decisão explícita do Gabriel (25/08): hospedagem pública fica pra depois**, quando o resto estiver pronto — ele avalia que não é difícil e prefere continuar iterando na loja antes. Risco assumido conscientemente: só descobrir problemas de hospedagem/fetch-hospedado perto do prazo. Claude não deve insistir nisso de novo a menos que o prazo (01/09 17h59) esteja se aproximando perigosamente.

**Ainda falta (obrigatório):** publicar a loja (GitHub Pages ou similar), rodar Lighthouse, gravar o vídeo e montar `/como-fiz`. Teste em celular real já foi feito via servidor local na rede Wi-Fi (26/08) — layout mobile validado e aprovado por Gabriel.

**Bônus considerados:** diagrama de arquitetura com BFF (+10, conceito já explicado a Gabriel — ver seção do desafio), vídeo auto-hospedado (+10, decisão pendente).
