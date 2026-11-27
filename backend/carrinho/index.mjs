/**
 * Lambda do carrinho (extra): GET /api/cart e PUT /api/cart.
 *
 * Guarda o carrinho do cliente logado no servidor, para ele acompanhar a
 * pessoa em qualquer aparelho. Quem é o cliente vem do token do Cognito
 * (claim "sub"): cada um só lê e grava o próprio carrinho.
 *
 * A validação aqui é só de FORMATO (tamanho da lista, tipos, limites). Se o
 * produto existe, se o tamanho existe e quanto custa, quem confere é o
 * checkout, que é a autoridade. Assim, este serviço não precisa ler a tabela
 * de outro serviço, e um carrinho com um produto que saiu do catálogo só é
 * barrado na hora de comprar, com uma mensagem clara.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

export const LIMITES = { itens: 20, unidadesPorItem: 10, textoMax: 60 };
/** O carrinho some sozinho depois de 30 dias sem mudança (TTL do DynamoDB). */
const DIAS_PARA_EXPIRAR = 30;

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(corpo),
});

const texto = (valor) => typeof valor === "string" && valor.length > 0 && valor.length <= LIMITES.textoMax;

/** Confere o formato dos itens. Devolve { erro } ou { itens } já limpos. */
export function validarItens(itens) {
  if (!Array.isArray(itens)) return { erro: "itens precisa ser uma lista." };
  if (itens.length > LIMITES.itens) return { erro: `O carrinho aceita no máximo ${LIMITES.itens} itens diferentes.` };
  for (const item of itens) {
    if (!texto(item?.produtoId) || !texto(item?.tamanho)) return { erro: "Cada item precisa de produtoId e tamanho." };
    if (!Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > LIMITES.unidadesPorItem) {
      return { erro: `A quantidade precisa ser de 1 a ${LIMITES.unidadesPorItem}.` };
    }
  }
  // Grava só os três campos conhecidos: nada além disso entra na tabela.
  return { itens: itens.map(({ produtoId, tamanho, quantidade }) => ({ produtoId, tamanho, quantidade })) };
}

export const handler = async (evento) => {
  const clienteId = evento?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!clienteId) return resposta(401, { erro: "Faça login para usar o carrinho salvo." });

  const chave = { PK: `CLIENTE#${clienteId}`, SK: "CARRINHO" };
  const metodo = evento.requestContext?.http?.method;

  if (metodo === "GET") {
    const { Item } = await dynamo.send(new GetCommand({ TableName: process.env.TABELA_CARRINHOS, Key: chave }));
    return resposta(200, { itens: Item?.itens ?? [], atualizadoEm: Item?.atualizadoEm ?? null });
  }

  if (metodo === "PUT") {
    let corpo;
    try {
      corpo = JSON.parse(evento.body ?? "");
    } catch {
      return resposta(400, { erro: "O corpo precisa ser um JSON válido." });
    }
    const { erro, itens } = validarItens(corpo?.itens);
    if (erro) return resposta(400, { erro });

    const atualizadoEm = new Date().toISOString();
    await dynamo.send(
      new PutCommand({
        TableName: process.env.TABELA_CARRINHOS,
        Item: { ...chave, itens, atualizadoEm, expiraEm: Math.floor(Date.now() / 1000) + DIAS_PARA_EXPIRAR * 24 * 3600 },
      }),
    );
    return resposta(200, { itens, atualizadoEm });
  }

  return resposta(405, { erro: "Método não permitido." });
};
