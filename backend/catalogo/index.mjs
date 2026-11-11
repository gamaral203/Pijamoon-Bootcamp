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

export const handler = async () => {
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
  const produtos = Items.map(({ PK, SK, GSI1PK, GSI1SK, ...produto }) => produto);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(produtos),
  };
};
