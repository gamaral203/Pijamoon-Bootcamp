/**
 * Lambda "disjuntor": tira o site do ar quando o tráfego dispara.
 *
 * Quem chama esta função é o SNS, avisado por um alarme do CloudWatch que
 * vigia quantos bytes o CloudFront entregou no último minuto. Um volume
 * desses não vem de gente navegando: é um script baixando o site em loop.
 *
 * Para desarmar, a função DESLIGA a distribuição do CloudFront: a borda para
 * de entregar tudo, inclusive o que estava em cache, e não há mais bytes
 * cobrados. A API, o alerta do Budgets e o resto do back-end continuam.
 *
 * Para religar (depois de entender o que aconteceu), invoque a mesma função:
 *   aws lambda invoke --function-name <FuncaoDisjuntor> --cli-binary-format raw-in-base64-out \
 *     --payload '{"acao":"religar"}' resposta.json
 */
import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } from "@aws-sdk/client-cloudfront";

const cloudfront = new CloudFrontClient();

/**
 * Liga ou desliga a distribuição. A API do CloudFront exige mandar a
 * configuração inteira de volta, com o ETag da versão lida (IfMatch): se
 * alguém tiver mudado a distribuição no meio do caminho, a atualização falha
 * em vez de sobrescrever a mudança.
 */
export async function definirLigada(ligada) {
  const id = process.env.ID_DISTRIBUICAO;
  const { DistributionConfig, ETag } = await cloudfront.send(new GetDistributionConfigCommand({ Id: id }));
  if (DistributionConfig.Enabled === ligada) return "sem mudança";

  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: ETag,
      DistributionConfig: { ...DistributionConfig, Enabled: ligada },
    }),
  );
  return ligada ? "religada" : "desligada";
}

/** A mensagem do SNS diz se o alarme entrou em ALARM (só esse caso desarma). */
export function alarmeDisparou(evento) {
  return (evento?.Records ?? []).some((registro) => {
    try {
      return JSON.parse(registro.Sns.Message).NewStateValue === "ALARM";
    } catch {
      return false;
    }
  });
}

export const handler = async (evento) => {
  if (evento?.acao === "religar") {
    const resultado = await definirLigada(true);
    console.log(`Disjuntor religado à mão: distribuição ${process.env.ID_DISTRIBUICAO} ${resultado}.`);
    return { religado: true, resultado };
  }

  if (!alarmeDisparou(evento)) {
    console.log("Mensagem sem alarme disparado: nada a fazer.");
    return { desarmado: false };
  }

  const resultado = await definirLigada(false);
  console.log(`Disjuntor desarmado: distribuição ${process.env.ID_DISTRIBUICAO} ${resultado}.`);
  return { desarmado: true, resultado };
};
