-- Pijamoon — schema do catálogo no Supabase
--
-- Como rodar: no painel do Supabase, vá em "SQL Editor" (menu lateral),
-- cole este arquivo inteiro e clique em "Run". Cria a tabela, ativa RLS
-- (Row Level Security) e já insere os 6 produtos que hoje estão em
-- data/products.json.
--
-- Por que RLS com policy pública de leitura: a chave usada no site
-- (anon/public key) é, por design do Supabase, segura de expor no
-- navegador — quem controla o que ela pode fazer são as policies do
-- banco, não o sigilo da chave. Sem RLS habilitado (ou sem a policy
-- abaixo), a tabela fica bloqueada pra qualquer leitura por padrão.

create table if not exists produtos (
  id text primary key,
  nome text not null,
  categoria text not null,
  preco numeric(10, 2) not null,
  descricao text not null,
  imagem text not null,
  imagem_costas text,
  foco_hero integer,
  tamanhos text[] not null default '{}'
);

alter table produtos enable row level security;

create policy "Catalogo e publico pra leitura"
  on produtos
  for select
  to anon
  using (true);

-- Sem policy de insert/update/delete pra "anon" de propósito: edição do
-- catálogo continua feita manualmente (aqui no SQL Editor, ou na aba
-- "Table Editor" do Supabase), não pelo site. Ver ideia de área de admin
-- anotada no PROJETO.md — não é obrigatória, fica pra depois.

insert into produtos (id, nome, categoria, preco, descricao, imagem, imagem_costas, foco_hero, tamanhos) values
  ('pijama-estrelas-xadrez', 'Pijama Estrelas de Xadrez', 'alcinha', 89.90, 'Conjunto de alcinha e short em xadrez azul lavanda com estrelinhas rosa, leve como uma noite de céu limpo.', 'img/produtos/ALCINHA1.jpg', 'img/produtos/ALCINHA1.2.jpg', 32, array['P','M','G','GG']),
  ('pijama-canela-aconchego', 'Pijama Canela Aconchego', 'americano', 94.90, 'Regata e short canelados em caramelo, com acabamento cru — simples, macio e confortável pra qualquer noite quente.', 'img/produtos/SIMPLES1.jpg', 'img/produtos/SIMPLES1.2.jpg', 30, array['P','M','G','GG']),
  ('pijama-jardim-encantado', 'Pijama Jardim Encantado', 'calça', 119.90, 'Camiseta manga curta e calça comprida com estampa de florzinhas coloridas — a calça extra mantém o pé quentinho nas noites mais frias.', 'img/produtos/DECALCA1.jpg', 'img/produtos/DECALCA1.2.jpg', 34, array['P','M','G','GG']),
  ('pijama-laco-de-lua', 'Pijama Laço de Lua', 'camisa', 109.90, 'Camisa de botão e short com estampa de laçinhos pretos sobre fundo claro — um clássico atemporal pra dormir com estilo.', 'img/produtos/AMERICANO1.jpg', 'img/produtos/AMERICANO1.2.jpg', 30, array['P','M','G','GG']),
  ('camisola-limonada', 'Camisola Limonada', 'camisola', 79.90, 'Camisola de alcinha rosa com estampa de limões, fresquinha e leve — perfeita pras noites mais quentes.', 'img/produtos/CAMISOLA1.jpg', 'img/produtos/CAMISOLA1.2.jpg', 42, array['P','M','G','GG']),
  ('pijama-poa-dos-sonhos', 'Pijama Poá dos Sonhos', 'alcinha', 89.90, 'Regata e short lilás de poá branco, com detalhes em rosa — doce e confortável como um cochilo de tarde.', 'img/produtos/PRODUTO1.1.jpg', 'img/produtos/PRODUTO1.2.jpg', 50, array['P','M','G','GG'])
on conflict (id) do nothing;
