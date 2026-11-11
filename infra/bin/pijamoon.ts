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

const app = new cdk.App();

new PijamoonStack(app, 'PijamoonStack', {
  env: {
    // A conta vem das credenciais da CLI: a mesma stack sobe na conta pessoal
    // ou na conta do desafio sem mudar o código.
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // A região fica fixa de propósito: a CLI local usa eu-west-1 como padrão.
    region: 'us-east-1',
  },
  description: 'Pijamoon: loja serverless orientada a eventos (Desafio 1)',
});
