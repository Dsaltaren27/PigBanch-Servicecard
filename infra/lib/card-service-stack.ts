import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoTables } from './dynamodb';
import { SqsQueues } from './sqs';
import { S3Buckets } from './s3';
import { Lambdas } from './lambdas';
import { ApiGateway } from './api-gateway';

export interface CardServiceStackProps extends cdk.StackProps {
    stage: string;
}

export class CardServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CardServiceStackProps) {
        super(scope, id, props);

        // ── DynamoDB ───────────────────────────────────────────────────────────
        const dynamo = new DynamoTables(this, 'DynamoTables', {
            stage: props.stage,
        });

        // ── SQS ───────────────────────────────────────────────────────────────
        const queues = new SqsQueues(this, 'SqsQueues', {
            stage: props.stage,
        });

        // ── S3 ────────────────────────────────────────────────────────────────
        const buckets = new S3Buckets(this, 'S3Buckets', {
            stage: props.stage,
            accountId: this.account,
        });

        // ── Lambdas ───────────────────────────────────────────────────────────
        const lambdas = new Lambdas(this, 'Lambdas', {
            stage: props.stage,
            cardTable: dynamo.cardTable,
            transactionTable: dynamo.transactionTable,
            cardTableError: dynamo.cardTableError,
            createRequestCardQueue: queues.createRequestCardQueue,
            errorCreateRequestCardQueue: queues.errorCreateRequestCardQueue,
            transactionsReportBucket: buckets.transactionsReportBucket,
        });

        // ── API Gateway ───────────────────────────────────────────────────────
        new ApiGateway(this, 'ApiGateway', {
            stage: props.stage,
            cardActivateLambda: lambdas.cardActivateLambda,
            cardPurchaseLambda: lambdas.cardPurchaseLambda,
            cardTransactionSaveLambda: lambdas.cardTransactionSaveLambda,
            cardPaidCreditCardLambda: lambdas.cardPaidCreditCardLambda,
            cardGetReportLambda: lambdas.cardGetReportLambda,
        });
    }
}