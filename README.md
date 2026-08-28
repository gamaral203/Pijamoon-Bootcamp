# 🌙 Pijamoon

Loja de pijamas — desafio **"Minha Loja no Ar"** do **AI/R Fellowship**, turma do Bootcamp **"AWS AI FDE for Commerce"**, promovida pela **AIR Academy** e o **Innovation Studio Digital Commerce**, com apoio da **AWS**.

**🔗 Loja no ar:** https://drifd8sm57jac.cloudfront.net

## Sobre

Vitrine de pijamas com catálogo carregado dinamicamente de um banco de dados (Supabase — nenhum produto fica hardcodado no HTML), busca e filtro por categoria, hero em carrossel, página de detalhes com tamanhos, carrinho de compras, login e checkout simulados, e modo escuro alternável.

Site estático — HTML, CSS e TypeScript puro, sem framework e sem bundler.

## Funcionalidades

- 🔍 Busca por nome + filtro por categoria
- 🖼️ Hero em carrossel, montado a partir das próprias fotos do catálogo
- 👕 Página de detalhes do produto (fotos de frente/costas, tamanhos, quantidade)
- 🛒 Carrinho de compras persistido no navegador
- 🔐 Login simulado — obrigatório pra finalizar a compra
- 💳 Checkout com endereço de entrega e pagamento simulado (cartão ou Pix)
- 🌗 Modo claro/escuro alternável, salvo por página

> Login, carrinho e checkout são **simulados no navegador** (`localStorage`) — este é um site estático, sem servidor nem banco de dados por trás. Nenhum dado real é enviado ou processado.

## Stack

- HTML, CSS e TypeScript (compilado com `tsc`, sem bundler nem módulos)
- Hospedado na AWS: **S3** (origem privada) + **CloudFront** (CDN), com Origin Access Control
- Catálogo no **Supabase** (Postgres + API REST via `supabase-js`, RLS com policy pública só de leitura — ver `supabase/schema.sql`)

## Rodando localmente

```bash
npm install
npm run build      # compila ts/ para js/
```

Depois é só servir os arquivos estáticos da raiz do projeto (ex: extensão *Live Server* do VS Code, ou `npx serve`) e abrir `index.html` — o `fetch` do catálogo não funciona abrindo o arquivo direto (`file://`), precisa de um servidor.

Pra recompilar automaticamente enquanto edita o TypeScript:

```bash
npm run watch
```

## Estrutura

```
index.html            vitrine
produto/index.html    detalhes do produto
login/index.html      login simulado
carrinho/index.html   carrinho
checkout/index.html   endereço + pagamento simulado
como-fiz/index.html   vídeo explicativo do desafio

css/style.css          estilos (tema claro + escuro)
ts/                     código-fonte TypeScript (comentado)
js/                     gerado pelo tsc — não editar à mão
supabase/schema.sql     SQL da tabela `produtos` (RLS + dados)
img/produtos/           fotos dos produtos
```

## Mais detalhes

Este projeto é a entrega de um desafio de bootcamp — ver [`PROJETO.md`](PROJETO.md) para o histórico completo de decisões técnicas, arquitetura do deploy na AWS e o que ainda falta.
