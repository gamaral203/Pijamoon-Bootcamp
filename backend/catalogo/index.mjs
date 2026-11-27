/**
 * Lambda do catálogo: GET /api/products.
 *
 * Lista todos os produtos com um Query no índice GSI1 (GSI1PK = CATALOG),
 * sem Scan: a leitura só toca a partição do catálogo, mesmo que a tabela
 * cresça. O nome da tabela chega por variável de ambiente, definida pelo CDK.
 *
 * O AWS SDK v3 já vem no runtime Node.js da Lambda, então não precisa ser
 * empacotado junto com este arquivo.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Fora do handler: o cliente é criado uma vez por ambiente (no cold start)
// e reaproveitado nas próximas invocações.
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

// Por quanto tempo o catálogo pode ser reaproveitado sem ir ao DynamoDB.
// O catálogo quase nunca muda, então 60 s de atraso não atrapalha ninguém.
const CACHE_SEGUNDOS = 60;

// Cache em memória: também fica fora do handler, então sobrevive entre as
// invocações do mesmo ambiente da Lambda. Cada ambiente tem o seu próprio
// cache, e ele some quando o ambiente é desligado. Não custa nada a mais.
let cache = { produtos: null, expiraEm: 0 };

async function buscarProdutos() {
  const { Items = [] } = await dynamo.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :catalogo",
      ExpressionAttributeValues: { ":catalogo": "CATALOG" },
    }),
  );

  // As chaves são detalhe de como o banco guarda os dados: o front recebe
  // só os campos do produto.
  return Items.map(({ PK, SK, GSI1PK, GSI1SK, ...produto }) => produto);
}

export const handler = async () => {
  const agora = Date.now();
  const doCache = cache.produtos !== null && agora < cache.expiraEm;

  if (!doCache) {
    cache = { produtos: await buscarProdutos(), expiraEm: agora + CACHE_SEGUNDOS * 1000 };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      // O navegador também guarda a resposta por 60 s: quem navega entre as
      // páginas da loja nem chega a chamar a API de novo.
      "cache-control": `public, max-age=${CACHE_SEGUNDOS}`,
      // Só para conferir o cache funcionando (aparece no DevTools).
      "x-cache-lambda": doCache ? "HIT" : "MISS",
    },
    body: JSON.stringify(cache.produtos),
  };
};
