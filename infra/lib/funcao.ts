import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

const RAIZ = path.join(__dirname, '..', '..');

export interface FuncaoNodeProps {
  /** Pasta do código dentro de backend/ (ex.: "checkout"). */
  readonly pasta: string;
  readonly descricao: string;
  readonly ambiente?: Record<string, string>;
  readonly memoriaMb?: number;
  readonly timeout?: cdk.Duration;
}

/**
 * Cria uma Lambda no padrão do projeto: Node.js 24 em ARM (Graviton, ~20%
 * mais barato que x86), código de backend/<pasta>/index.mjs e logs guardados
 * por uma semana, apagados no `cdk destroy`.
 */
export function funcaoNode(escopo: Construct, id: string, props: FuncaoNodeProps): lambda.Function {
  return new lambda.Function(escopo, id, {
    description: props.descricao,
    runtime: lambda.Runtime.NODEJS_24_X,
    architecture: lambda.Architecture.ARM_64,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(path.join(RAIZ, 'backend', props.pasta)),
    memorySize: props.memoriaMb ?? 256,
    timeout: props.timeout ?? cdk.Duration.seconds(10),
    environment: props.ambiente,
    logGroup: new logs.LogGroup(escopo, `${id}Logs`, {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
  });
}
