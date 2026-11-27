/**
 * Lambda que consulta um pedido: GET /api/orders/{pedidoId}.
 *
 * O site chama esta rota depois do checkout para saber se o pedido já foi
 * criado. Logo depois do 202 a resposta pode ser 404: o evento ainda está
 * a caminho (EventBridge → fila → Lambda). Esse intervalo é a parte
 * assíncrona do fluxo, e o site mostra "processando" até o pedido aparecer.
 *
 * A consulta é pelo número do pedido, um UUID aleatório que só quem fez o
 * pedido conhece. A lista "meus pedidos" chega na Etapa 7, quando o cliente
 * for identificado pelo token do Cognito, e não por um dado enviado pelo site.
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
  const pedidoId = evento.pathParameters?.pedidoId ?? "";
  if (!UUID.test(pedidoId)) return resposta(400, { erro: "Número de pedido inválido." });

  const { Item } = await dynamo.send(
    new GetCommand({
      TableName: process.env.TABELA_PEDIDOS,
      Key: { PK: `PEDIDO#${pedidoId}`, SK: "META" },
    }),
  );

  if (!Item) return resposta(404, { erro: "Pedido não encontrado (ou ainda em processamento)." });

  const { PK, SK, ...pedido } = Item;
  return resposta(200, pedido);
};
