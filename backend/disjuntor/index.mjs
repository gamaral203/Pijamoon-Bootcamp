/**
 * Lambda "disjuntor": tira o site do ar quando o tráfego dispara.
 *
 * Quem chama esta função é o SNS, avisado por um alarme do CloudWatch que
 * vigia quantos bytes o Amplify entregou no último minuto. Um volume desses
 * não vem de gente navegando: é um script baixando o site em loop, e cada GB
 * entregue custa dinheiro (a conta tem teto de US$ 20 por mês).
 *
 * Para desarmar, a função liga uma senha aleatória na branch do Amplify.
 * A partir daí, qualquer visitante recebe um 401 de poucos bytes, em vez das
 * páginas e imagens. A senha não é guardada em lugar nenhum: ninguém entra.
 *
 * Para religar o site (depois de entender o que aconteceu):
 *   aws amplify update-branch --app-id <id> --branch-name main --no-enable-basic-auth
 */
import { randomBytes } from "node:crypto";
import { AmplifyClient, UpdateBranchCommand } from "@aws-sdk/client-amplify";

const amplify = new AmplifyClient();

export const handler = async (evento) => {
  // O SNS pode trazer mais de uma mensagem. Só desarma quando o alarme entrou
  // em ALARM: a volta ao normal (OK) também gera mensagem, e essa é ignorada.
  const disparou = (evento.Records ?? []).some((registro) => {
    try {
      return JSON.parse(registro.Sns.Message).NewStateValue === "ALARM";
    } catch {
      return false;
    }
  });

  if (!disparou) {
    console.log("Mensagem sem alarme disparado: nada a fazer.");
    return { desarmado: false };
  }

  // O Amplify espera "usuario:senha" em Base64.
  const credenciais = Buffer.from(`bloqueado:${randomBytes(24).toString("hex")}`).toString("base64");

  await amplify.send(
    new UpdateBranchCommand({
      appId: process.env.APP_ID,
      branchName: process.env.BRANCH_NAME,
      enableBasicAuth: true,
      basicAuthCredentials: credenciais,
    }),
  );

  console.log(`Disjuntor desarmado: o site ${process.env.APP_ID}/${process.env.BRANCH_NAME} saiu do ar.`);
  return { desarmado: true };
};
