import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { apagarLogsNoDestroy } from './regras';
import { ServicoCheckout } from './servico-checkout';
import { ServicoPedidos } from './servico-pedidos';

/** Raiz do repositório, para achar backend/ e os dados a partir de infra/lib/. */
const RAIZ = path.join(__dirname, '..', '..');

/**
 * Limite da API: 2 requisições por segundo em média, com picos de até 10.
 * Para uma loja de demonstração, isso sobra (cada página faz uma chamada).
 *
 * A conta do pior caso, alguém chamando a API sem parar o mês inteiro:
 *   2/s × 30 dias ≈ 5,2 milhões de requisições
 *   API Gateway ≈ US$ 5,18 + Lambda ≈ US$ 1,21 + logs ≈ US$ 1,04 ≈ US$ 7,43
 * Com 5/s, o mesmo cálculo dava ≈ US$ 18,58: perto demais do teto de US$ 20,
 * ainda mais porque o throttling do API Gateway é aproximado, não exato.
 */
export const LIMITE_API = { porSegundo: 2, pico: 10 };

/**
 * O back-end da Pijamoon: catálogo (tabela, Lambda e API). Tudo o que esta
 * stack declara sobe junto num `cdk deploy` e desce junto num `cdk destroy`.
 *
 * A hospedagem do site fica em outra stack (PijamoonSite), porque depende
 * do que a conta permite: o back-end sobe em qualquer conta.
 */
export class PijamoonStack extends cdk.Stack {
  /** A API da loja, usada pela stack do site para encaminhar /api/*. */
  public readonly api: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ------------------------------------------------------------------
     * Catálogo: tabela → dados iniciais → Lambda → rota na API
     * ------------------------------------------------------------------ */

    // Tabela do catálogo, com o mesmo desenho da Fase 1:
    //   PK = PRODUCT#<id>, SK = META   → um item por produto
    //   GSI1PK = CATALOG               → listar o catálogo com Query, sem Scan
    const tabelaProdutos = new dynamodb.TableV2(this, 'TabelaProdutos', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        },
      ],
      // O padrão do CDK é RETAIN: o `cdk destroy` não apaga a tabela, para
      // não perder dados de produção. Neste projeto de estudo a tabela é
      // recriada a cada deploy, então ela pode ser apagada junto com a stack.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Dados iniciais: os 6 produtos de infra/dados/produtos.json, gravados
    // na tabela durante o deploy com uma chamada BatchWriteItem.
    const produtos: Record<string, unknown>[] = JSON.parse(
      fs.readFileSync(path.join(RAIZ, 'infra', 'dados', 'produtos.json'), 'utf-8'),
    );
    const gravarProdutos: cr.AwsSdkCall = {
      service: 'dynamodb',
      action: 'BatchWriteItem',
      parameters: {
        RequestItems: {
          [tabelaProdutos.tableName]: produtos.map((produto) => ({
            PutRequest: {
              Item: paraDynamoJson({
                PK: `PRODUCT#${produto.id}`,
                SK: 'META',
                GSI1PK: 'CATALOG',
                GSI1SK: `PRODUCT#${produto.id}`,
                ...produto,
              }),
            },
          })),
        },
      },
      // O id muda quando o JSON muda: aí o CloudFormation roda a gravação
      // de novo e a tabela recebe os produtos atualizados.
      physicalResourceId: cr.PhysicalResourceId.of(
        `produtos-${createHash('sha256').update(JSON.stringify(produtos)).digest('hex').slice(0, 12)}`,
      ),
    };
    new cr.AwsCustomResource(this, 'DadosIniciaisProdutos', {
      onCreate: gravarProdutos,
      onUpdate: gravarProdutos,
      // Permissão só para BatchWriteItem nesta tabela.
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [tabelaProdutos.tableArn],
      }),
      // O SDK que já vem no runtime basta; instalar o mais novo custa ~60 s por deploy.
      installLatestAwsSdk: false,
    });

    // Lambda do catálogo: o código vem de backend/catalogo/ do jeito que está.
    const funcaoCatalogo = new lambda.Function(this, 'FuncaoCatalogo', {
      description: 'Lista o catálogo da Pijamoon (GET /api/products)',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64, // Graviton: ~20% mais barato que x86
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(RAIZ, 'backend', 'catalogo')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: { TABLE_NAME: tabelaProdutos.tableName },
      logGroup: new logs.LogGroup(this, 'LogsCatalogo', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Substitui a policy escrita à mão na Fase 1: o CDK gera a IAM policy
    // de leitura (tabela e índices) e anexa à role da Lambda.
    tabelaProdutos.grantReadData(funcaoCatalogo);

    // API HTTP: por enquanto só a rota do catálogo.
    const api = new apigwv2.HttpApi(this, 'ApiLoja', {
      description: 'API da loja Pijamoon',
    });
    api.addRoutes({
      path: '/api/products',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('IntegracaoCatalogo', funcaoCatalogo),
    });

    // Limite de requisições (throttling) para todas as rotas do stage padrão.
    // A conta tem teto de US$ 20 por mês: o limite é o que impede um script
    // de gerar uma conta alta chamando a API sem parar. Passando disso, o
    // API Gateway responde 429 (Too Many Requests) sem nem chamar a Lambda.
    //   rateLimit: média de requisições por segundo
    //   burstLimit: pico curto permitido acima da média
    // O HttpApi cria o stage $default sozinho, então o ajuste é feito
    // direto no recurso do CloudFormation (L1) que está por baixo dele.
    const stagePadrao = api.defaultStage!.node.defaultChild as apigwv2.CfnStage;
    stagePadrao.defaultRouteSettings = {
      throttlingRateLimit: LIMITE_API.porSegundo,
      throttlingBurstLimit: LIMITE_API.pico,
    };

    this.api = api;

    /* ------------------------------------------------------------------
     * Checkout e pedidos: a parte orientada a eventos
     *
     *   POST /api/checkout → Lambda checkout → (evento) EventBridge
     *     → regra → fila SQS (+ DLQ) → Lambda processa → tabela de pedidos
     * ------------------------------------------------------------------ */

    // O barramento de eventos da loja: um "quadro de avisos" próprio, separado
    // do barramento padrão da conta (onde chegam os eventos dos serviços AWS).
    const barramento = new events.EventBus(this, 'BarramentoLoja', {
      description: 'Eventos de negócio da Pijamoon (ex.: PedidoRecebido)',
    });

    new ServicoCheckout(this, 'Checkout', { api, barramento, tabelaProdutos });
    const pedidos = new ServicoPedidos(this, 'Pedidos', { api, barramento });

    apagarLogsNoDestroy(this);

    /* ------------------------------------------------------------------
     * Saídas: aparecem no terminal no fim do deploy
     * ------------------------------------------------------------------ */
    new cdk.CfnOutput(this, 'UrlCatalogo', { value: `${api.apiEndpoint}/api/products` });
    new cdk.CfnOutput(this, 'NomeTabelaProdutos', { value: tabelaProdutos.tableName });
    new cdk.CfnOutput(this, 'UrlCheckout', { value: `${api.apiEndpoint}/api/checkout` });
    new cdk.CfnOutput(this, 'NomeBarramento', { value: barramento.eventBusName });
    new cdk.CfnOutput(this, 'NomeTabelaPedidos', { value: pedidos.tabela.tableName });
    new cdk.CfnOutput(this, 'UrlFilaPedidos', { value: pedidos.fila.queueUrl });
    new cdk.CfnOutput(this, 'UrlDlqPedidos', { value: pedidos.dlq.queueUrl });
  }
}

/**
 * Converte um objeto JS para o formato "DynamoDB JSON" que a API de baixo
 * nível espera: { nome: "x" } vira { nome: { S: "x" } }, números viram
 * { N: "..." } e listas viram { L: [...] }.
 */
function paraDynamoJson(objeto: Record<string, unknown>): Record<string, unknown> {
  const converter = (valor: unknown): unknown => {
    if (typeof valor === 'string') return { S: valor };
    if (typeof valor === 'number') return { N: String(valor) };
    if (typeof valor === 'boolean') return { BOOL: valor };
    if (Array.isArray(valor)) return { L: valor.map(converter) };
    if (valor && typeof valor === 'object') {
      return { M: paraDynamoJson(valor as Record<string, unknown>) };
    }
    throw new Error(`Tipo não suportado no DynamoDB JSON: ${String(valor)}`);
  };
  return Object.fromEntries(Object.entries(objeto).map(([chave, valor]) => [chave, converter(valor)]));
}
