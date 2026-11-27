import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { funcaoNode } from './funcao';

export interface ServicoCarrinhoProps {
  readonly api: apigwv2.HttpApi;
  readonly authorizer: apigwv2.IHttpRouteAuthorizer;
}

/**
 * Serviço de carrinho (extra): o carrinho do cliente logado, salvo no
 * servidor para acompanhá-lo em qualquer aparelho.
 *
 *   GET /api/cart  → lê o carrinho do dono do token
 *   PUT /api/cart  → troca o carrinho inteiro (o site manda a lista completa)
 *
 * Tabela própria, como todo serviço. Sem login, o site continua usando só o
 * localStorage, como antes.
 */
export class ServicoCarrinho extends Construct {
  public readonly tabela: dynamodb.TableV2;

  constructor(escopo: Construct, id: string, props: ServicoCarrinhoProps) {
    super(escopo, id);

    // PK = CLIENTE#<sub do Cognito>, SK = CARRINHO → um carrinho por cliente
    this.tabela = new dynamodb.TableV2(this, 'TabelaCarrinhos', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'expiraEm', // carrinho esquecido some em 30 dias
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const funcao = funcaoNode(this, 'FuncaoCarrinho', {
      pasta: 'carrinho',
      descricao: 'Lê e grava o carrinho do cliente logado (GET e PUT /api/cart)',
      ambiente: { TABELA_CARRINHOS: this.tabela.tableName },
    });
    // GetItem e PutItem na própria tabela, e nada de outras tabelas.
    this.tabela.grantReadWriteData(funcao);

    props.api.addRoutes({
      path: '/api/cart',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration('IntegracaoCarrinho', funcao),
      authorizer: props.authorizer,
    });
  }
}
