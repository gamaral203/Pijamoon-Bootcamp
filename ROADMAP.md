# Roadmap do backend na AWS

Projeto de estudo: evoluir a Pijamoon de uma loja com catálogo no Supabase para uma arquitetura serverless na AWS. As fases 2 a 4 são planos de estudo e podem mudar.

## ✅ Fase 1: catálogo (concluída)

- [x] Criar alerta de gastos, ativar MFA e ajustar permissões
- [x] Criar a primeira Lambda
- [x] Expor `GET /api/products` no API Gateway
- [x] Ver e resolver o erro de CORS
- [x] Criar a tabela, o GSI e os 6 produtos no DynamoDB
- [x] Fazer a Lambda ler do banco, com menor privilégio
- [x] Colocar a API atrás do CloudFront
- [x] Trocar o Supabase no front e publicar

## Fase 2: login e carrinho

- [ ] Criar o Cognito User Pool
- [ ] Trocar o login simulado pelo Cognito
- [ ] Proteger as rotas com JWT authorizer
- [ ] Criar `POST /cart`, com os itens no DynamoDB

## Fase 3: checkout com eventos

- [ ] Criar `POST /checkout`, gravando o pedido
- [ ] Orquestrar cobrança, estoque e estorno com Step Functions, usando pagamento simulado
- [ ] Publicar o evento de pedido confirmado no SNS
- [ ] Criar a fila SQS, a DLQ e o worker de notificação
- [ ] Testar falhas e mensagens repetidas (idempotência)

## Fase 4: infraestrutura como código

- [ ] Criar o projeto CDK em TypeScript
- [ ] Recriar os recursos no CDK, com o SDK empacotado no deploy
- [ ] Testar um deploy do zero e remover o que foi criado à mão
- [ ] Revisar o projeto pelos 6 pilares do Well-Architected
