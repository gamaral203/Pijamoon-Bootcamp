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
- [x] Hospedado de graça — **no ar de verdade na AWS** (S3 + CloudFront), não em GitHub Pages/Netlify/etc como o PDF sugeria de exemplo (a lista é só sugestão, "hospedado de graça" é o requisito real). URL: https://drifd8sm57jac.cloudfront.net
- [ ] Página `/como-fiz` com vídeo respondendo, na ordem: (1) organização do código, (2) por que o catálogo é separado do front / headless commerce, (3) mapeamento pra AWS + cache/CDN (browser → CDN → origem), (4) Lighthouse rodado ao vivo, (5) onde plugaria IA + o que foi mais difícil. — **pendente**, página existe mas o iframe do vídeo está vazio; vídeo ainda não gravado.

### Avaliação
Clareza da explicação (30) · Domínio técnico (25) · Loja no ar (20) · Lighthouse comentado (15) · Conexão com os workshops (10).

### Bônus
- [ ] Vídeo auto-hospedado (+10) — decisão pendente.
- [ ] Diagrama de arquitetura com BFF para app mobile (+10) — conceito já explicado a Gabriel, diagrama ainda não feito.
- [x] Carrinho + checkout fictício (26/08) — carrinho persistido no navegador, login simulado obrigatório pra finalizar a compra. Ver seção própria em Decisões abaixo.
- [ ] Dark mode — não iniciado.

## Decisões já tomadas

- **Sem framework.** TypeScript é permitido (compila para JS puro via `tsc`, sem bundler). Justificativa: nota é pela explicação, não pelo stack; vanilla/TS é mais fácil de defender linha por linha numa call.
- **Catálogo em `products.json` real, sem banco de dados.** Foi cogitado usar banco real (professor teria liberado verbalmente), mas decidimos seguir o que está escrito no documento oficial do desafio para não arriscar os 20 pontos do critério "Loja no ar". Se Gabriel confirmar a exceção por escrito com o professor, reavaliar.
- **Não usar os outros projetos Pijamoon como referência** (`pijamoon-catalogo`, `pijamoon`, `pijamoon-react` — repositórios reais e distintos do Gabriel). Este projeto é isolado, construído do zero.
- **Escopo evoluiu além do básico (atualizado 26/08).** O plano original era "básico primeiro, sem carrinho/checkout/extras", mas ao longo do desenvolvimento Gabriel pediu e foram adicionados: página de detalhes do produto com foto ampliada, descrição completa e tamanhos (P/M/G/GG), navegação entre foto de frente/costas, dropdown de categorias no cabeçalho, ícones decorativos de conta/carrinho (sem função ainda — pensados como base pro checkout, que ele quer fazer depois), carrossel de fotos no hero (autoplay, setas, dots, ponto de foco por foto via campo `focoHero` em `products.json`) e uma faixa de selos de confiança (frete/pagamento/segurança/suporte) entre o hero e a grade de produtos. Carrinho/checkout de verdade continuam para depois, não são item pontuado no PDF oficial.
- **Detalhe do produto é página própria, não modal (atualizado 26/08).** Começou como modal (popup por cima da vitrine), mas Gabriel pediu uma transição de página de verdade, tipo loja real. Virou `produto/index.html?id=...` — segue o mesmo padrão multi-página que já existia em `/como-fiz`. `ts/shared.ts` guarda o que os dois scripts (`app.ts` da vitrine e `produto.ts` da página de detalhe) precisam em comum (buscar catálogo, formatar preço, etc.), carregado antes de cada um via `<script>` — sem bundler, sem import/export, só ordem de carregamento.
- **Carrinho + login obrigatório pra comprar (26/08).** Gabriel pediu carrinho com compra travada até logar. Como o site é estático (sem servidor, sem banco — requisito obrigatório já cumprido), um login "de verdade" com senha validada não é possível sem sair desse escopo. Decisão tomada com Gabriel: **login 100% simulado no navegador**, salvo em `localStorage` (`pijamoon_usuario`), sem senha real verificada em lugar nenhum — mesma honestidade dos botões "em breve"/decorativos já usados no projeto. Fluxo: navegar e adicionar ao carrinho não exige login; só o botão **"Finalizar compra"** exige. Sem login, redireciona pra `login/index.html?next=carrinho/index.html` e volta pro carrinho depois de entrar.
  - Novas páginas: `login/index.html` (formulário nome/e-mail/senha, senha não é validada — só preenchida por completude visual) e `carrinho/index.html` (lista de itens, quantidade, remover, total, finalizar).
  - Carrinho persistido em `localStorage` (`pijamoon_carrinho`) como lista de `{produtoId, tamanho, quantidade}` — sobrevive a fechar/reabrir o navegador, mas é local a cada dispositivo (não sincroniza entre celular e PC, por exemplo, porque não tem servidor).
  - "Finalizar compra" com login feito: limpa o carrinho e mostra uma tela de "Pedido confirmado" — não processa pagamento nenhum (checkout fictício, como o PDF permite como bônus).
  - Ponto pra pergunta 5 do vídeo (onde entraria IA) e pergunta 3 (AWS): numa loja de verdade, esse login viraria um serviço de autenticação de verdade (Cognito, Auth0, Firebase Auth) rodando fora do site estático, e o carrinho seria persistido num backend em vez do `localStorage`.
  - Problema técnico resolvido no caminho: os scripts de cada página (`app.ts`, `produto.ts`, `login.ts`, `carrinho.ts`) declaravam variáveis com o mesmo nome (`RAIZ`, `catalogo`) e davam erro de compilação, porque sem bundler/módulos o TypeScript trata todos os arquivos como um escopo global só. Resolvido envolvendo cada script de página numa IIFE (`(function () { ... })();`), isolando o escopo de cada um — só `shared.ts` fica de fato global.
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
├── login/index.html      ← login simulado (localStorage, sem servidor)
├── carrinho/index.html   ← carrinho (itens, quantidade, ir pro checkout)
├── checkout/index.html   ← endereço + pagamento simulado (cartão/Pix)
├── css/style.css
├── ts/shared.ts          ← Produto, carregarProdutos, formatarPreco, capitalizar,
│                            estado de usuário/carrinho, atualizarHeaderConta
├── ts/app.ts             ← lógica da vitrine (hero, busca, filtro, grade)
├── ts/produto.ts         ← lógica da página de detalhes + adicionar ao carrinho
├── ts/login.ts           ← lógica do login simulado
├── ts/carrinho.ts        ← lógica do carrinho (itens, quantidade, ir pro checkout)
├── ts/checkout.ts        ← lógica do checkout (endereço, pagamento, confirmar)
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

**Modal virou página de produto de verdade (26/08):** o clique no card agora navega pra `produto/index.html?id=...` (mesmo padrão de página separada que `/como-fiz` já usava) em vez de abrir um popup por cima da vitrine. A página tem breadcrumb, galeria com frente/costas, tamanhos (P/M/G/GG, campo `tamanhos` no `products.json`), seletor de quantidade e botão de comprar (na época, desabilitado — hoje já é o "Adicionar ao carrinho" funcional, ver abaixo). Todo o código do modal foi removido; lógica compartilhada entre a vitrine e a página de produto ficou em `ts/shared.ts`. Dois bugs achados testando essa mudança:
  - `/como-fiz` reaproveitava a classe `.hero` que virou o carrossel — quebrou o hero de texto simples dessa página. Corrigido separando em `.hero` (texto simples, páginas secundárias) e `.hero-carrossel` (fotos, só na home).
  - A tela de "produto não encontrado" não escondia o layout por baixo: o atributo `hidden` do HTML e a regra `.produto-detalhe { display: flex }` têm a mesma especificidade CSS, e a regra vencia. Corrigido com `.produto-detalhe[hidden] { display: none }`.

**Lighthouse rodado e 3 problemas reais corrigidos (26/08):** antes de gravar o vídeo de verdade, rodamos o Lighthouse (F12 → Lighthouse) pra já chegar preparado. Scores antes → depois: Performance 76→94, Accessibility 94→100, Best Practices 96→96 (ver nota abaixo), SEO 100→100.
  - **Contraste de texto insuficiente** em 3 lugares (subtítulo dos selos de confiança, contador "N produtos encontrados", rodapé): o texto cinza-azulado (`var(--azul-petroleo)` com opacidade baixa) ficava abaixo do mínimo de 4.5:1 exigido pra acessibilidade (WCAG AA). Calculado matematicamente (fórmula de luminância relativa) a opacidade mínima que passa — 0.82 — e usado 0.85 com folga, em vez de só "escurecer no olho".
  - **Ordem de heading quebrada:** a faixa de confiança usava `<h3>` pulando direto do `<h1>` do hero, sem `<h2>` no meio — erro real de hierarquia que atrapalha leitor de tela. Como são só rótulos de selo (não títulos de seção), viraram `<p class="confianca-titulo">` estilizado igual.
  - **Favicon 404:** navegador pedia `/favicon.ico`, não achava, e isso virava erro no console (conta pra Best Practices). Resolvido com um favicon SVG inline (a luinha dourada), sem precisar de arquivo novo — e adicionado nas 3 páginas (`index.html`, `produto/index.html`, `como-fiz/index.html`).
  - **Nota sobre o 96 em Best Practices:** o item que falta ("Content security policy" no painel Issues) é causado pelo **Live Server do VS Code** (o script que ele injeta pra dar refresh automático), não pelo código do site — confirmado rodando o mesmo Lighthouse contra um servidor sem essa injeção, que deu 100/100/100. Deve sumir sozinho quando a loja estiver hospedada de verdade. Bom ponto pra comentar no vídeo: mostra que dá pra diferenciar "problema real" de "artefato da ferramenta de desenvolvimento".
  - **Duas oportunidades de performance identificadas mas deixadas pra depois** (Gabriel decidiu não mexer agora): imagens dos produtos servidas em 900×1350 mas exibidas bem menores nos cards da grade (~347 KiB de banda desperdiçada — resolveria com `srcset`/versões menores) e fontes do Google Fonts bloqueando a primeira renderização (~830ms). Válido citar no vídeo como "o que eu melhoraria primeiro" mesmo sem ter corrigido.

**Lighthouse confirmado na URL real da AWS (26/08):** Gabriel rodou o Lighthouse (mobile e desktop) direto contra `https://drifd8sm57jac.cloudfront.net`. Resultado: **mobile** Performance 96 · Acessibilidade 100 · Best Practices 100 · SEO 100; **desktop** Performance 99 · Acessibilidade 100 · Best Practices 100 · SEO 100. Confirma a hipótese anotada acima: o 96 em Best Practices era mesmo só artefato do Live Server local — na AWS de verdade deu 100. Ótimo material pra pergunta 4 do vídeo (rodar ao vivo e comparar com o que já foi visto local vs. produção).

**Carrinho + login simulado implementados e testados (26/08):** ver a decisão detalhada acima ("Carrinho + login obrigatório pra comprar"). Testado com Playwright de ponta a ponta: adicionar ao carrinho (com tamanho e quantidade), badge do carrinho atualizando no cabeçalho, mudar quantidade e remover item no carrinho, total recalculando, bloqueio real ao tentar finalizar sem login (redireciona e volta pro carrinho depois), login persistindo entre recarregamentos de página (localStorage), logout pelo ícone de conta, carrinho vazio, e finalizar compra limpando o carrinho e mostrando a tela de sucesso. 35 combinações de página×largura (5 páginas, 320px a 1904px) sem overflow horizontal nem erro no console.
  - Ícones de conta/carrinho do cabeçalho, que eram só placeholder "em breve", agora são funcionais em todas as páginas (`index.html`, `produto/index.html`, `login/index.html`, `carrinho/index.html`).

**Botão "Comprar agora" (26/08):** Gabriel notou que nem todo cliente quer passar pelo carrinho — às vezes é mais direto ir logo pra compra. A página de produto agora tem dois botões: **"Adicionar ao carrinho"** (contorno, secundário — guarda o item e continua navegando) e **"Comprar agora"** (sólido, primário — guarda o item com o tamanho/quantidade escolhidos e já leva direto pro carrinho, pronto pra finalizar). Reaproveita 100% da lógica que já existia (mesma função de salvar no carrinho, mesma página de carrinho com o bloqueio de login) — só muda o que acontece depois de guardar o item.

**Nome do usuário no cabeçalho + checkout com endereço/pagamento simulado (26/08):** duas coisas pedidas pelo Gabriel:
  - Nome de quem está logado agora aparece ao lado do ícone de conta (antes só dava pra ver passando o mouse no tooltip). Some no mobile pra não apertar o cabeçalho.
  - "Finalizar compra" no carrinho deixou de finalizar ali direto — agora leva pra uma página nova, `checkout/index.html`, com formulário de endereço de entrega (CEP, rua, número, complemento, bairro, cidade, UF) e escolha de pagamento (cartão de crédito ou Pix, com QR code fake e código copia-e-cola). "Confirmar pagamento" limpa o carrinho e mostra a tela de sucesso, que saiu do carrinho e passou a viver só ali.
  - Endereço e dados de pagamento **são obrigatórios pra confirmar** (Gabriel pediu depois de notar que dava pra comprar sem preencher nada) — validação via `required` nativo do HTML, sem checar formato/conteúdo real (CEP não é validado contra API dos Correios, cartão não é validado de verdade — é tudo simulação, só não pode ficar vazio).
  - Testado com Playwright (login persistindo entre páginas, troca cartão/Pix, botão de copiar Pix, guard rails de login/carrinho vazio, mobile 375px sem overflow) — nenhum bug funcional real encontrado no fluxo de login (a suspeita inicial de Gabriel não se confirmou, já funcionava certo).
  - **Quatro casos do mesmo tipo de bug encontrados e corrigidos** ao testar de verdade: três eram o bug de CSS já visto em `.produto-detalhe[hidden]` (`.checkout-grid`, `.checkout-layout`, `.produto-fotos-dots` tinham `display` fixo brigando com `[hidden]`). O quarto foi diferente: **`display: none` não tira um campo da validação HTML5** (só `disabled` tira) — ao escolher Pix, os campos de cartão escondidos continuavam com `required`, bloqueando o envio mesmo sem aparecer na tela. Corrigido alternando o `required` deles junto com a troca de método de pagamento. Ótimo exemplo pro vídeo: "parece igual mas `display:none` e `disabled` têm efeitos bem diferentes na validação".

**Confirmação do professor sobre products.json vs. banco de dados (26/08):** Gabriel perguntou direto pro Johni (contato oficial do desafio) se, optando por banco de dados real, o `products.json` continuava obrigatório — resposta: não, pode desconsiderar, os produtos ficariam no banco. Isso resolve a dúvida que já estava registrada aqui ("se confirmar a exceção por escrito, reavaliar"). Decisão tomada com Gabriel depois de pesar o trade-off: **manter o `products.json` como está**, sem migrar pra banco de dados agora — o risco de não terminar a tempo (faltando ainda publicar, gravar vídeo, rodar Lighthouse ao vivo) pesou mais que o ganho. Banco de dados fica como "próximo passo" pra citar na pergunta 5 do vídeo, não implementado de verdade.

**Loja publicada de verdade na AWS (26/08):** Gabriel quis fazer o deploy na AWS de propósito (não em GitHub Pages/Netlify), já que o Bootcamp cobriu isso no workshop do Romulo (20/08) e é literalmente o assunto da pergunta 3 do vídeo. Arquitetura:
  - **S3** (`pijamoon-loja-gabriel`, região `us-east-1`) guarda os arquivos do site — bucket **privado** (sem acesso público direto).
  - **CloudFront** (CDN) na frente, com **Origin Access Control (OAC)** — só o CloudFront tem permissão de ler o bucket (via política do bucket restrita ao ARN da distribution), ninguém acessa o S3 direto. Prática recomendada atual da AWS, mais segura que bucket público + site estático do S3.
  - HTTPS forçado (`redirect-to-https`), cache policy gerenciada da AWS (`CachingOptimized`), `Default root object` = `index.html`.
  - **URL pública: https://drifd8sm57jac.cloudfront.net**
  - Upload dos arquivos pro S3 foi feito **manualmente pelo Console** por Gabriel (ele quis fazer essa parte, não via CLI) — só as pastas/arquivo do site (`index.html`, `css/`, `js/`, `data/`, `img/`, e as páginas `como-fiz/`, `produto/`, `login/`, `carrinho/`, `checkout/`), sem `node_modules`, `.git`, `ts/` nem os arquivos de config do TypeScript.
  - Criação do bucket, OAC, distribution e política foram feitos via AWS CLI (usuário IAM `Gabriel_Amaral` — precisou receber as policies `AmazonS3FullAccess` e `CloudFrontFullAccess`, não tinha permissão nem de listar bucket antes disso).
  - Testado com Playwright direto na URL de produção: home carrega, 6 produtos renderizam, sem erro de console.
  - Bom material pra pergunta 3 do vídeo: a jornada real é `navegador → CloudFront (edge cache) → S3 (origem, só na primeira vez ou cache expirado)`, com HTTPS e origem privada.
  - **Atenção:** o S3 não sincroniza sozinho com o git. Depois de qualquer commit que mude arquivo do site, alguém precisa re-subir o(s) arquivo(s) mudado(s) pro bucket e rodar uma invalidação do CloudFront (`aws cloudfront create-invalidation --distribution-id ER9G66Y0YYVCL --paths "/*"`), senão o CloudFront serve a versão em cache antiga por até 24h.

**Ideia futura anotada, não obrigatória (26/08):** Gabriel comentou que, se um dia o catálogo migrar pra um banco de dados de verdade (ex: Supabase, cogitado antes — ver decisão acima de manter `products.json` por enquanto), faria sentido ter uma área de **admin** pra cadastrar/editar produto sem mexer em código. Não faz sentido com o `products.json` atual (edição é direto no arquivo). Não construir agora — só registrar a ideia pra quando/se migrar pra banco real.

**Ainda falta (obrigatório):** gravar o vídeo (incluindo rodar o Lighthouse **ao vivo** de novo na hora da gravação, contra a URL da AWS agora — o que já foi feito antes foi só preparação/correção local) e montar `/como-fiz` com o vídeo embutido. Teste em celular real já foi feito via servidor local na rede Wi-Fi (26/08) — layout mobile validado e aprovado por Gabriel.

**Bônus considerados:** diagrama de arquitetura com BFF (+10, conceito já explicado a Gabriel — ver seção do desafio), vídeo auto-hospedado (+10, decisão pendente).
