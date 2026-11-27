import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CiCdStack, REPOSITORIO } from '../lib/cicd-stack';

const template = Template.fromStack(
  new CiCdStack(new cdk.App(), 'TesteCiCd', { env: { account: '111111111111', region: 'us-east-1' } }),
);

test('cria o provedor OIDC do GitHub, aceitando só tokens para a AWS (sts)', () => {
  template.hasResourceProperties('AWS::IAM::OIDCProvider', {
    Url: 'https://token.actions.githubusercontent.com',
    ClientIdList: ['sts.amazonaws.com'],
  });
});

test('só o workflow da branch main deste repositório assume a role, sem curingas', () => {
  const [role] = Object.values(template.findResources('AWS::IAM::Role'));
  const [regra] = role.Properties.AssumeRolePolicyDocument.Statement;

  expect(regra.Action).toBe('sts:AssumeRoleWithWebIdentity');
  expect(regra.Condition).toEqual({
    StringEquals: {
      'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      'token.actions.githubusercontent.com:sub': `${REPOSITORIO.prefixoSub}:ref:refs/heads/main`,
    },
  });
  expect(JSON.stringify(regra.Condition)).not.toContain('*');
  expect(regra.Condition.StringLike).toBeUndefined();
});

test('a role só pode assumir as roles do cdk bootstrap: nada de administrador', () => {
  const [policy] = Object.values(template.findResources('AWS::IAM::Policy'));
  const declaracoes = policy.Properties.PolicyDocument.Statement;

  expect(declaracoes).toHaveLength(1);
  expect(declaracoes[0]).toMatchObject({ Effect: 'Allow', Action: 'sts:AssumeRole' });
  // o ARN vira um Fn::Join por causa da partição ("aws"); o texto junto mostra o alvo
  const arn = JSON.stringify(declaracoes[0].Resource);
  expect(arn).toContain(':role/cdk-hnb659fds-*-111111111111-us-east-1');

  const [role] = Object.values(template.findResources('AWS::IAM::Role'));
  expect(role.Properties.ManagedPolicyArns).toBeUndefined();
});

test('as credenciais valem no máximo 1 hora', () => {
  template.hasResourceProperties('AWS::IAM::Role', { MaxSessionDuration: 3600 });
});
