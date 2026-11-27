/**
 * Lambda que devolve a mensagem de um pedido: GET /api/orders/{pedidoId}/mensagem.
 *
 * Protegida pelo token do Cognito: só o dono do pedido vê a mensagem. Logo
 * depois do checkout ela pode ainda não existir (o Bedrock está escrevendo),
 * e a resposta é 404 até ficar pronta; o site tenta de novo algumas vezes.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(corpo),
});

export const handler = async (evento) => {
  const clienteId = evento?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!clienteId) return resposta(401, { erro: "Faça login para ver a mensagem." });

  const pedidoId = evento.pathParameters?.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return resposta(400, { erro: "Número de pedido inválido." });

  const { Item } = await dynamo.send(
    new GetCommand({ TableName: process.env.TABELA_MENSAGENS, Key: { PK: `PEDIDO#${pedidoId}`, SK: "MENSAGEM" } }),
  );

  // De outra pessoa responde igual a inexistente, como na consulta de pedidos.
  if (!Item || Item.clienteId !== clienteId) return resposta(404, { erro: "Mensagem ainda não disponível." });
  return resposta(200, { pedidoId, mensagem: Item.mensagem, origem: Item.origem });
};
