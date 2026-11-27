import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/** O repositório e a branch que podem implantar a loja. */
export const REPOSITORIO = {
  /**
   * Prefixo do "sub" do token do GitHub. Este repositório usa o formato
   * imutável (dono@id/repo@id), e não o simples (dono/repo): conferido com
   * `gh api repos/gamaral203/Pijamoon-Bootcamp/actions/oidc/customization/sub`.
   */
  prefixoSub: 'repo:gamaral203@201172374/Pijamoon-Bootcamp@1346690770',
  branch: 'main',
};

/** Nome padrão das roles criadas pelo `cdk bootstrap` (qualificador hnb659fds). */
const QUALIFICADOR_BOOTSTRAP = 'hnb659fds';

/**
 * Deploy pelo GitHub Actions, sem nenhuma chave da AWS guardada no GitHub.
 *
 *   GitHub Actions ──(token OIDC assinado pelo GitHub)──▶ AWS STS
 *        ◀──(credenciais temporárias, ~1 hora)── se o token for do repo e da branch certos
 *   GitHub Actions ──(cdk deploy)──▶ assume as roles do bootstrap ──▶ CloudFormation
 *
 * Esta stack é implantada uma vez, à mão: é ela que dá ao GitHub o direito
 * de implantar as outras. Por isso não entra no `cdk deploy --all` do workflow.
 */
export class CiCdStack extends cdk.Stack {
  public readonly roleDeploy: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // O "cartório" que a AWS consulta para conferir a assinatura dos tokens
    // do GitHub. Um por conta. O thumbprint é exigido pela API, mas para o
    // GitHub a AWS valida o certificado pela própria lista de autoridades.
    const provedorGitHub = new iam.OidcProviderNative(this, 'ProvedorGitHub', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1', '1c58a3a8518e8759bf075b76b750d4f2df264fcd'],
    });

    // A trust policy é a regra de quem pode "vestir" a role: só um token
    // emitido para a AWS (aud) pelo workflow da branch main deste repositório
    // (sub). StringEquals, e não StringLike: nada de curingas, nem outra
    // branch, nem pull request, nem fork.
    this.roleDeploy = new iam.Role(this, 'RoleDeployGitHub', {
      roleName: 'pijamoon-github-deploy',
      description: 'Assumida pelo GitHub Actions (OIDC) para rodar o cdk deploy da Pijamoon',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provedorGitHub.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `${REPOSITORIO.prefixoSub}:ref:refs/heads/${REPOSITORIO.branch}`,
        },
      }),
    });

    // Menor privilégio: a role não pode criar nada sozinha. Ela só pode
    // assumir as roles que o `cdk bootstrap` já criou (deploy, publicação de
    // arquivos e consulta), e são elas que falam com o CloudFormation.
    this.roleDeploy.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-${QUALIFICADOR_BOOTSTRAP}-*-${this.account}-${this.region}`],
      }),
    );

    new cdk.CfnOutput(this, 'ArnRoleDeploy', {
      value: this.roleDeploy.roleArn,
      description: 'Vai na variável AWS_ROLE_DEPLOY do repositório no GitHub',
    });
  }
}
