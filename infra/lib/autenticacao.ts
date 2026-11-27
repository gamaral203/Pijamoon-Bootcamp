import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';

/**
 * Login da loja com Amazon Cognito.
 *
 * Na analogia da portaria: o User Pool é a recepção, que confere o documento
 * (e-mail e senha) e entrega o crachá (o token JWT). O authorizer é a
 * catraca do API Gateway, que confere o crachá antes de deixar a requisição
 * chegar à Lambda.
 *
 *   site ──(e-mail e senha)──▶ Cognito ──(tokens)──▶ site
 *   site ──(Authorization: Bearer <token>)──▶ API Gateway ──(token válido?)──▶ Lambda
 *
 * A senha vai do navegador direto para o Cognito, por HTTPS: ela nunca
 * passa pela nossa API nem pelas nossas Lambdas.
 */
export class Autenticacao extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly clienteSite: cognito.UserPoolClient;
  public readonly authorizer: HttpUserPoolAuthorizer;

  constructor(escopo: Construct, id: string) {
    super(escopo, id);

    this.userPool = new cognito.UserPool(this, 'UsuariosLoja', {
      // Plano Lite: cadastro e login com e-mail e senha bastam, e é o mais
      // barato (US$ 0,0055 por usuário ativo no mês; o Essentials é US$ 0,015).
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true, // o próprio cliente cria a conta
      signInAliases: { email: true }, // o e-mail é o login
      signInCaseSensitive: false, // "Ana@Exemplo.com" e "ana@exemplo.com" são a mesma conta
      autoVerify: { email: true }, // a conta só vale depois de confirmar o e-mail
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true }, // vira a claim "name" do token
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // O e-mail com o código sai pelo envio padrão do Cognito, sem custo e
      // sem configurar o SES (o limite diário é baixo, mas sobra para a demo).
      userVerification: {
        emailSubject: 'Pijamoon: seu código de confirmação',
        emailBody: 'Olá! Seu código para confirmar a conta na Pijamoon é {####}. Bons sonhos! 🌙',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // projeto de estudo: sai junto no cdk destroy
    });

    // O "app client" é a identidade do site perante o Cognito. Ele é público
    // (roda no navegador), então não tem segredo (client secret).
    this.clienteSite = this.userPool.addClient('ClienteSite', {
      authFlows: {
        userPassword: true, // InitiateAuth com USER_PASSWORD_AUTH, chamado direto pelo site
      },
      generateSecret: false,
      // Sem a tela pronta do Cognito (OAuth): o login é um formulário do site.
      disableOAuth: true,
      // Login errado responde sempre "e-mail ou senha incorretos": não revela
      // se aquele e-mail tem conta na loja.
      preventUserExistenceErrors: true,
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30), // renova o login sem pedir a senha
    });

    // A catraca: valida a assinatura do token, quem emitiu (este User Pool),
    // para quem foi emitido (este app client) e se ainda não venceu. Sem
    // token válido, o API Gateway responde 401 e a Lambda nem é chamada.
    this.authorizer = new HttpUserPoolAuthorizer('AutorizadorLoja', this.userPool, {
      userPoolClients: [this.clienteSite],
    });
  }
}
