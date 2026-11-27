/**
 * Lambda que consulta pedidos. Atende duas rotas, as duas protegidas pelo
 * token do Cognito (JWT authorizer no API Gateway):
 *
 *   GET /api/orders             → os pedidos do cliente logado, do mais novo ao mais antigo
 *   GET /api/orders/{pedidoId}  → um pedido, só se ele for do cliente logado
 *
 * Quem é o cliente vem do token (claim "sub"), nunca de um dado enviado pelo
 * site. Por isso a lista é segura: não existe parâmetro para pedir os pedidos
 * "de outra pessoa".
 *
 * Logo depois do checkout, o pedido pode ainda não existir: o evento está a
 * caminho (EventBridge → fila → Lambda). A consulta por número responde 404
 * nesse intervalo, e o site mostra "processando" até o pedido aparecer.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Quantos pedidos a lista devolve, no máximo. */
export const LIMITE_LISTA = 50;

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(corpo),
});

/** Tira as chaves internas do banco: o site recebe só os campos do pedido. */
const semChaves = ({ PK, SK, GSI1PK, GSI1SK, ...pedido }) => pedido;

async function buscarPedido(clienteId, pedidoId) {
  if (!UUID.test(pedidoId)) return resposta(400, { erro: "Número de pedido inválido." });

  const { Item } = await dynamo.send(
    new GetCommand({
      TableName: process.env.TABELA_PEDIDOS,
      Key: { PK: `PEDIDO#${pedidoId}`, SK: "META" },
    }),
  );

  // Pedido de outra pessoa responde igual a pedido inexistente (404): assim
  // a API nem confirma que aquele número existe.
  if (!Item || Item.cliente?.id !== clienteId) {
    return resposta(404, { erro: "Pedido não encontrado (ou ainda em processamento)." });
  }
  return resposta(200, semChaves(Item));
}

async function listarPedidos(clienteId) {
  const { Items = [] } = await dynamo.send(
    new QueryCommand({
      TableName: process.env.TABELA_PEDIDOS,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :cliente",
      ExpressionAttributeValues: { ":cliente": `CLIENTE#${clienteId}` },
      ScanIndexForward: false, // GSI1SK é a data: false = do mais novo para o mais antigo
      Limit: LIMITE_LISTA,
    }),
  );
  return resposta(200, Items.map(semChaves));
}

export const handler = async (evento) => {
  const clienteId = evento?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!clienteId) return resposta(401, { erro: "Faça login para ver os seus pedidos." });

  const pedidoId = evento.pathParameters?.pedidoId;
  return pedidoId === undefined ? listarPedidos(clienteId) : buscarPedido(clienteId, pedidoId);
};
