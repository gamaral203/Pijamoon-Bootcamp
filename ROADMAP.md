# Roadmap do backend na AWS

Projeto de estudo: evoluir a Pijamoon de uma loja com catálogo no Supabase para uma arquitetura serverless na AWS, com um microsserviço por domínio (catálogo, carrinho e pedido).

As fases estão na ordem em que os conceitos dependem uns dos outros: cada uma usa o que a anterior ensinou. Cada fase termina com perguntas **Para fixar**. A fase só conta como concluída quando você consegue respondê-las com as suas palavras, sem consultar nada. As fases 2 a 6 são planos e podem mudar.

## ✅ Fase 1: catálogo (concluída)

- [x] Criar alerta de gastos, ativar MFA e ajustar permissões
- [x] Criar a primeira Lambda
- [x] Expor `GET /api/products` no API Gateway
- [x] Ver e resolver o erro de CORS
- [x] Criar a tabela, o GSI e os 6 produtos no DynamoDB
- [x] Fazer a Lambda ler do banco, com menor privilégio
- [x] Colocar a API atrás do CloudFront
- [x] Trocar o Supabase no front e publicar

## ✅ Deploy automático do site (concluído)

- [x] Criar o workflow no GitHub Actions (instalar, compilar e montar só os arquivos do site)
- [x] Cadastrar o GitHub como provedor OIDC na AWS
- [x] Criar a role de deploy, com permissão só para o bucket e a invalidação do CloudFront
- [x] Publicar no S3 e invalidar o cache a cada push na `main`

## Fase 2: infraestrutura como código (CDK)

Vem antes das funcionalidades novas para que carrinho e pedido já nasçam como código. Começa recriando o catálogo, que você já conhece: assim você aprende só o CDK, sem um serviço novo ao mesmo tempo.

**Conceitos:** IaC · App, Stack e Construct · L1, L2 e L3 · `synth`, `diff`, `deploy` e `destroy` · bootstrap · `RemovalPolicy` · `grant*`

- [ ] Instalar o CDK e rodar o `cdk bootstrap` na conta (uma vez por conta e região)
- [ ] Criar o projeto CDK em TypeScript e trazer o código da Lambda do catálogo para o repositório
- [ ] Declarar a tabela, a Lambda e a API do catálogo como constructs
- [ ] Trocar a policy escrita à mão por `grant*`
- [ ] Ler o `cdk diff`, fazer o deploy e popular a tabela com os 6 produtos
- [ ] Apontar o CloudFront para a API nova e testar a loja
- [ ] Apagar os recursos criados pelo console
- [ ] Rodar o deploy da infraestrutura pelo GitHub Actions

**Para fixar**
- Qual a diferença entre um construct L1 e um L2? Quando usar o L1?
- O que o `cdk diff` mostra, e por que ler antes do deploy?
- O que acontece com os dados da tabela num `cdk destroy`, com e sem `RemovalPolicy.RETAIN`?
- Que policy o `grantReadData` gera, comparada com a que você escreveu na Fase 1?

## Fase 3: carrinho (microsserviço síncrono)

O primeiro serviço novo: rotas, função e tabela próprias, sem acessar a tabela do catálogo.

**Conceitos:** microsserviço · database per service · CRUD REST · parâmetros de rota · `GetItem`, `PutItem` e `DeleteItem` · validação de entrada · códigos de status HTTP

- [ ] Criar a tabela do carrinho, com uma tabela só para o serviço
- [ ] Criar a Lambda do carrinho, com um `switch` por método e rota
- [ ] Expor `GET`, `POST` e `DELETE` em `/api/basket`
- [ ] Validar o corpo da requisição e devolver `400` quando estiver errado
- [ ] Trocar o carrinho do `localStorage` pela API no front
- [ ] Testar as rotas e o fluxo na loja

**Para fixar**
- Por que o carrinho não deve ler a tabela do catálogo direto? Como ele descobre o preço de um produto?
- Quando usar `GetItem` e quando usar `Query`?
- Qual a diferença entre responder `400`, `404` e `500`?

## Fase 4: checkout com eventos (assíncrono)

O checkout não cria o pedido: ele publica um evento, e o serviço de pedidos cria o pedido no seu próprio ritmo.

**Conceitos:** síncrono x assíncrono · desacoplamento · EventBridge (bus, regra e alvo) · event pattern · SQS · event source mapping · batch · visibility timeout · DLQ e redrive · entrega "pelo menos uma vez" · idempotência

- [ ] Criar o event bus da loja
- [ ] Criar `POST /api/basket/checkout`: calcular o total, publicar o evento e só depois apagar o carrinho
- [ ] Criar a regra que manda o evento de checkout para uma fila SQS
- [ ] Criar a fila com DLQ e `maxReceiveCount`
- [ ] Criar a tabela de pedidos (`PK` usuário, `SK` data do pedido) e a Lambda que lê a fila e grava o pedido
- [ ] Expor `GET /api/order` para listar os pedidos do usuário com `Query`
- [ ] Mostrar a confirmação e os pedidos no front
- [ ] Testar: mandar o mesmo evento duas vezes e confirmar que só existe um pedido
- [ ] Testar: forçar um erro na Lambda e ver a mensagem chegar na DLQ

**Para fixar**
- Por que o checkout responde na hora se o pedido ainda não existe?
- O que se perde se o EventBridge chamar a Lambda direto, sem a fila no meio?
- Por que o carrinho não pode ser apagado se a publicação do evento falhar?
- Como a Lambda de pedidos sabe se foi chamada pela fila ou pela API?
- Por que o visibility timeout precisa ser maior que o timeout da Lambda?

## Fase 5: login real (Cognito)

Até aqui o usuário é informado pelo próprio front, então qualquer pessoa poderia pedir o carrinho de outra. Nesta fase, o usuário passa a vir do token.

**Conceitos:** autenticação x autorização · User Pool · JWT · JWT authorizer no API Gateway · claims

- [ ] Criar o User Pool no CDK
- [ ] Trocar o login simulado pelo Cognito no front
- [ ] Proteger as rotas de carrinho e pedido com o JWT authorizer
- [ ] Ler o usuário do token na Lambda, e não do corpo da requisição

**Para fixar**
- Qual a diferença entre autenticar e autorizar?
- Por que o usuário não pode vir do corpo da requisição?
- Quem valida o token: a Lambda ou o API Gateway?

## Fase 6: pronto para produção

**Conceitos:** observabilidade · métricas e alarmes · ambientes (dev e prod) · os 6 pilares do Well-Architected

- [ ] Criar alarmes para erros nas Lambdas, mensagens na DLQ e idade da mensagem mais antiga na fila
- [ ] Separar ambientes de dev e prod com a mesma stack, mudando só o contexto
- [ ] Revisar o projeto pelos 6 pilares do Well-Architected e anotar o que melhorar

**Para fixar**
- Que alarme avisa que os pedidos estão travados antes de um cliente reclamar?
- O que muda entre dev e prod, e o que não pode mudar?
- Qual pilar do Well-Architected o projeto atende pior hoje, e por quê?
