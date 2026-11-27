#!/usr/bin/env node
/**
 * Ponto de partida do CDK: aqui nasce o App e as stacks que ele contém.
 * É o equivalente à classe com o main() num projeto Spring Boot.
 *
 * O cdk.json manda o CDK rodar este arquivo. Cada `new ...Stack(app, ...)`
 * vira uma stack do CloudFormation na conta.
 */
import * as cdk from 'aws-cdk-lib/core';
import { PijamoonStack } from '../lib/pijamoon-stack';
import { SiteStack } from '../lib/site-stack';
import { CustosStack } from '../lib/custos-stack';
import { aplicarTagsDeCusto } from '../lib/regras';

const app = new cdk.App();

const env = {
  // A conta vem das credenciais da CLI (--profile): as mesmas stacks sobem na
  // conta pessoal ou na conta do desafio sem mudar o código.
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // A região fica fixa de propósito: a CLI local usa eu-west-1 como padrão.
  region: 'us-east-1',
};

// Tags de custo em todos os recursos de todas as stacks (ver lib/regras.ts).
aplicarTagsDeCusto(app);

// Back-end: catálogo (tabela, Lambda e API). Sobe em qualquer conta.
const backend = new PijamoonStack(app, 'PijamoonStack', {
  env,
  description: 'Pijamoon: back-end serverless orientado a eventos (Desafio 1)',
});

// Hospedagem do site. Por enquanto é CloudFront + S3, que a conta do desafio
// bloqueia: lá, esta stack ainda não é implantada.
new SiteStack(app, 'PijamoonSite', {
  env,
  api: backend.api,
  description: 'Pijamoon: hospedagem do site',
});

// Alerta de custo. O e-mail não fica no código (o repositório é público):
// ele vem no comando, com -c emailAlertas=voce@exemplo.com. Sem o e-mail,
// a stack simplesmente não é criada.
const emailAlertas = app.node.tryGetContext('emailAlertas');
if (emailAlertas) {
  new CustosStack(app, 'PijamoonCustos', {
    env,
    emailAlertas,
    limiteMensalUsd: 20,
    description: 'Pijamoon: alerta de custo no AWS Budgets (teto de US$ 20/mês)',
  });
}
