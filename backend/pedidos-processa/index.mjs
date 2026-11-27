/**
 * Lambda que processa os pedidos: lê a fila do SQS e grava na tabela.
 *
 * É a "cozinha" do restaurante: pega as comandas da fila, no ritmo dela.
 * Cada mensagem da fila é um evento "PedidoRecebido" que o EventBridge
 * entregou, com o pedido inteiro em `detail`.
 *
 * Duas regras importantes:
 *
 * 1. Idempotência. O SQS entrega cada mensagem PELO MENOS uma vez: às vezes
 *    a mesma mensagem chega de novo. A gravação só acontece se o pedido
 *    ainda não existe (attribute_not_exists). Se já existe, a mensagem é
 *    uma repetição e é ignorada, sem criar um segundo pedido.
 *
 * 2. Falha parcial. A Lambda recebe um lote de mensagens. Se uma falhar, só
 *    ela volta para a fila (batchItemFailures), e não o lote inteiro. Depois
 *    de algumas tentativas, a mensagem vai para a DLQ, para alguém olhar.
 */
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

/** Grava um pedido. Devolve "criado" ou "repetido". */
export async function gravarPedido(pedido) {
  if (!pedido?.pedidoId) throw new Error("Evento sem pedidoId.");

  try {
    await dynamo.send(
      new PutCommand({
        TableName: process.env.TABELA_PEDIDOS,
        Item: {
          PK: `PEDIDO#${pedido.pedidoId}`,
          SK: "META",
          // Índice por cliente: lista "meus pedidos" do mais novo para o mais antigo.
          ...(pedido.cliente?.id && { GSI1PK: `CLIENTE#${pedido.cliente.id}`, GSI1SK: pedido.criadoEm }),
          ...pedido,
          status: "CONFIRMADO",
          processadoEm: new Date().toISOString(),
        },
        // A trava da idempotência: só grava se ainda não houver um item com
        // esta chave. O DynamoDB faz a checagem e a gravação de uma vez só,
        // então nem duas Lambdas ao mesmo tempo conseguem duplicar o pedido.
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return "criado";
  } catch (erro) {
    if (erro instanceof ConditionalCheckFailedException || erro?.name === "ConditionalCheckFailedException") {
      return "repetido";
    }
    throw erro;
  }
}

export const handler = async (evento) => {
  const batchItemFailures = [];

  for (const mensagem of evento.Records ?? []) {
    try {
      // O corpo da mensagem é o evento do EventBridge; o pedido está em detail.
      const { detail } = JSON.parse(mensagem.body);
      const resultado = await gravarPedido(detail);
      console.log(`Pedido ${detail.pedidoId}: ${resultado}`);
    } catch (erro) {
      console.error(`Falha na mensagem ${mensagem.messageId}: ${erro.message}`);
      batchItemFailures.push({ itemIdentifier: mensagem.messageId });
    }
  }

  // O SQS apaga as mensagens que deram certo e devolve à fila só as listadas.
  return { batchItemFailures };
};
