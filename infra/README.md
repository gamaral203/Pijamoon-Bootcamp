# infra · stack CDK da Pijamoon

Infraestrutura da loja definida como código com AWS CDK (TypeScript).

- `bin/pijamoon.ts`: cria o App e a `PijamoonStack` (conta das credenciais da CLI, região `us-east-1`).
- `lib/pijamoon-stack.ts`: os recursos da stack.
- `test/`: testes que conferem o template gerado, sem acessar a AWS.

## Comandos

```bash
npm ci              # instala as dependências
npm run build       # confere os tipos do TypeScript
npm test            # roda os testes
npx cdk synth       # gera o template do CloudFormation em cdk.out/
npx cdk diff        # mostra o que vai mudar na conta
npx cdk deploy      # cria ou atualiza os recursos na AWS
npx cdk destroy     # remove a stack e os recursos dela
```

Antes do primeiro deploy numa conta nova: `npx cdk bootstrap aws://<conta>/us-east-1`.
