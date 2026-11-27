import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PijamoonStack } from '../lib/pijamoon-stack';

const template = Template.fromStack(new PijamoonStack(new cdk.App(), 'TesteAutenticacao'));

test('o User Pool usa o plano Lite, o e-mail como login e exige confirmar o e-mail', () => {
  template.hasResourceProperties('AWS::Cognito::UserPool', {
    UserPoolTier: 'LITE',
    UsernameAttributes: ['email'],
    AutoVerifiedAttributes: ['email'],
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: false }, // o cliente cria a própria conta
    Policies: { PasswordPolicy: Match.objectLike({ MinimumLength: 8, RequireNumbers: true, RequireLowercase: true }) },
  });
});

test('o User Pool sai junto no cdk destroy', () => {
  template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Delete' });
});

test('o app client do site é público, sem OAuth e com login por e-mail e senha', () => {
  template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    GenerateSecret: false,
    ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH']),
    PreventUserExistenceErrors: 'ENABLED',
    AllowedOAuthFlowsUserPoolClient: false,
  });
});

test('o authorizer do API Gateway confere tokens JWT do User Pool para o app client do site', () => {
  template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
    AuthorizerType: 'JWT',
    IdentitySource: ['$request.header.Authorization'],
    JwtConfiguration: {
      Audience: [{ Ref: Match.stringLikeRegexp('ClienteSite') }],
      Issuer: Match.anyValue(),
    },
  });
});
