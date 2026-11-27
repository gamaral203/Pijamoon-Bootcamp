/**
 * Lambda do checkout: POST /api/checkout.
 *
 * É o "garçom" do restaurante: confere o pedido, diz "recebido, número X"
 * e volta a atender. Ela NÃO grava o pedido: só publica o evento
 * "PedidoRecebido" no EventBridge e responde 202 Accepted. Quem cria o
 * pedido é o serviço de pedidos, depois, lendo a fila.
 *
 * Quem é o cliente NÃO vem no corpo: vem do token do Cognito, que o API
 * Gateway já conferiu (JWT authorizer) antes de chamar esta Lambda. Assim,
 * ninguém consegue fazer um pedido em nome de outra pessoa.
 *
 * Corpo esperado:
 *   {
 *     "itens":     [{ "produtoId": "camisola-limonada", "tamanho": "M", "quantidade": 2 }],
 *     "entrega":   { "cep": "01001-000", "rua": "...", "numero": "10", "complemento": "",
 *                    "bairro": "...", "cidade": "...", "estado": "SP" },
 *     "pagamento": "cartao" | "pix"
 *   }
 *
 * Os dados do cartão nunca chegam aqui: o pagamento é simulado no site, e
 * a API só recebe qual foi o método escolhido.
 */
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());
const eventbridge = new EventBridgeClient();

/** Limites de um pedido, para ninguém mandar um carrinho absurdo. */
export const LIMITES = { itensPorPedido: 20, unidadesPorItem: 10 };

const CAMPOS_ENTREGA = ["cep", "rua", "numero", "bairro", "cidade", "estado"];

/** O nome de cada campo do endereço como aparece na tela do checkout. */
const ROTULOS_ENTREGA = { cep: "CEP", rua: "Endereço", numero: "Número", bairro: "Bairro", cidade: "Cidade", estado: "Estado" };

// O catálogo fica 60 s em memória, como na Lambda do catálogo: o checkout
// precisa dos preços, mas eles quase nunca mudam.
let cacheCatalogo = { produtos: null, expiraEm: 0 };

async function catalogo() {
  if (cacheCatalogo.produtos && Date.now() < cacheCatalogo.expiraEm) {
    return cacheCatalogo.produtos;
  }
  const { Items = [] } = await dynamo.send(
    new QueryCommand({
      TableName: process.env.TABELA_PRODUTOS,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :catalogo",
      ExpressionAttributeValues: { ":catalogo": "CATALOG" },
    }),
  );
  cacheCatalogo = { produtos: new Map(Items.map((p) => [p.id, p])), expiraEm: Date.now() + 60_000 };
  return cacheCatalogo.produtos;
}

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(corpo),
});

const texto = (valor, max = 120) => typeof valor === "string" && valor.trim().length > 0 && valor.length <= max;

/**
 * Confere o pedido e monta a versão "oficial" dele. O preço e o nome vêm
 * sempre do catálogo, nunca do navegador: quem confia no preço enviado pelo
 * site deixa qualquer um comprar um pijama por R$ 0,01.
 * Devolve { erros } ou { pedido }.
 */
export function validarPedido(corpo, produtos) {
  const erros = [];
  const { itens, entrega, pagamento } = corpo ?? {};

  if (!Array.isArray(itens) || itens.length === 0) {
    erros.push("O carrinho está vazio.");
  } else if (itens.length > LIMITES.itensPorPedido) {
    erros.push(`O pedido aceita no máximo ${LIMITES.itensPorPedido} itens diferentes.`);
  }

  const itensConferidos = [];
  for (const [i, item] of (Array.isArray(itens) ? itens : []).entries()) {
    const produto = produtos.get(item?.produtoId);
    if (!produto) {
      erros.push(`Um produto do carrinho não existe mais na loja ("${item?.produtoId}").`);
      continue;
    }
    if (!produto.tamanhos?.includes(item.tamanho)) {
      erros.push(`${produto.nome}: o tamanho "${item.tamanho}" não está disponível.`);
    }
    if (!Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > LIMITES.unidadesPorItem) {
      erros.push(`${produto.nome}: a quantidade precisa ser de 1 a ${LIMITES.unidadesPorItem} unidades.`);
    }
    itensConferidos.push({
      produtoId: produto.id,
      nome: produto.nome,
      tamanho: item.tamanho,
      quantidade: item.quantidade,
      precoUnitario: produto.preco,
      subtotal: Math.round(produto.preco * item.quantidade * 100) / 100,
    });
  }

  for (const campo of CAMPOS_ENTREGA) {
    if (!texto(entrega?.[campo])) erros.push(`Preencha o campo "${ROTULOS_ENTREGA[campo]}" do endereço.`);
  }
  if (entrega?.complemento !== undefined && typeof entrega.complemento !== "string") {
    erros.push("O complemento do endereço precisa ser um texto.");
  }

  if (pagamento !== "cartao" && pagamento !== "pix") erros.push("Escolha cartão ou Pix como forma de pagamento.");

  if (erros.length > 0) return { erros };

  const total = Math.round(itensConferidos.reduce((soma, item) => soma + item.subtotal, 0) * 100) / 100;
  return {
    pedido: {
      itens: itensConferidos,
      total,
      entrega: Object.fromEntries(
        [...CAMPOS_ENTREGA, "complemento"].map((campo) => [campo, (entrega[campo] ?? "").trim()]),
      ),
      pagamento,
    },
  };
}

/**
 * Lê o cliente das "claims" do token. O API Gateway só chama esta Lambda
 * depois de validar a assinatura, o emissor (o nosso User Pool), o público
 * (o nosso app client) e a validade do token; aqui só lemos o conteúdo.
 *   sub   → id único e permanente do usuário no Cognito
 *   email → e-mail confirmado no cadastro
 *   name  → nome informado no cadastro
 */
export function clienteDoToken(evento) {
  const claims = evento?.requestContext?.authorizer?.jwt?.claims ?? {};
  if (!claims.sub || !claims.email) return null;
  return { id: claims.sub, nome: claims.name ?? "", email: String(claims.email).toLowerCase() };
}

export const handler = async (evento) => {
  // Defesa extra: se a rota for configurada sem o authorizer por engano,
  // não há cliente no token e o pedido é recusado.
  const cliente = clienteDoToken(evento);
  if (!cliente) return resposta(401, { erro: "Faça login para finalizar a compra." });

  let corpo;
  try {
    corpo = JSON.parse(evento.body ?? "");
  } catch {
    return resposta(400, { erro: "O corpo precisa ser um JSON válido." });
  }

  const { erros, pedido } = validarPedido(corpo, await catalogo());
  if (erros) return resposta(400, { erro: "Pedido inválido.", detalhes: erros });

  // O número do pedido nasce aqui, e segue junto com o evento: é ele que
  // permite ao serviço de pedidos reconhecer uma mensagem repetida.
  const pedidoId = randomUUID();
  const criadoEm = new Date().toISOString();

  const { FailedEntryCount } = await eventbridge.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.NOME_BARRAMENTO,
          Source: "pijamoon.checkout",
          DetailType: "PedidoRecebido",
          Detail: JSON.stringify({ pedidoId, criadoEm, cliente, ...pedido }),
        },
      ],
    }),
  );

  // O PutEvents pode "dar certo" e mesmo assim recusar a entrada: sem o
  // evento, o pedido nunca seria criado, então o cliente precisa saber.
  if (FailedEntryCount > 0) {
    console.error(`Falha ao publicar o pedido ${pedidoId} no EventBridge.`);
    return resposta(503, { erro: "Não foi possível registrar o pedido agora. Tente de novo." });
  }

  // Sem dados pessoais no log: só o número e o total.
  console.log(`Pedido ${pedidoId} recebido: R$ ${pedido.total}`);

  // 202 Accepted: "recebi e vou processar", não "está pronto".
  return resposta(202, { pedidoId, status: "RECEBIDO", total: pedido.total });
};
