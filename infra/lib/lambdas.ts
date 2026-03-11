import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEvents from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

export interface LambdasProps {
    stage: string;
    cardTable: dynamodb.Table;
    transactionTable: dynamodb.Table;
    cardTableError: dynamodb.Table;
    createRequestCardQueue: sqs.Queue;
    errorCreateRequestCardQueue: sqs.Queue;
    transactionsReportBucket: s3.Bucket;
    sesFromEmail: string;
}

export class Lambdas extends Construct {
    public readonly createRequestCardLambda: lambdaNodejs.NodejsFunction;
    public readonly cardActivateLambda: lambdaNodejs.NodejsFunction;
    public readonly cardPurchaseLambda: lambdaNodejs.NodejsFunction;
    public readonly cardTransactionSaveLambda: lambdaNodejs.NodejsFunction;
    public readonly cardPaidCreditCardLambda: lambdaNodejs.NodejsFunction;
    public readonly cardGetReportLambda: lambdaNodejs.NodejsFunction;
    public readonly cardRequestFailedLambda: lambdaNodejs.NodejsFunction;

    constructor(scope: Construct, id: string, props: LambdasProps) {
        super(scope, id);

        const sharedEnv = {
            STAGE: props.stage,
            CARD_TABLE_NAME: props.cardTable.tableName,
            TRANSACTION_TABLE_NAME: props.transactionTable.tableName,
            CARD_TABLE_ERROR_NAME: props.cardTableError.tableName,
            TRANSACTIONS_REPORT_BUCKET: props.transactionsReportBucket.bucketName,
            USER_TABLE_NAME: 'user-table',
        };

        const sharedLambdaProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
            runtime: lambda.Runtime.NODEJS_16_X,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: sharedEnv,
            bundling: {
                minify: true,
                sourceMap: false,
                target: 'node20',
            },
        };

        // ── create-request-card ────────────────────────────────────────────────
        this.createRequestCardLambda = new lambdaNodejs.NodejsFunction(
            this, 'CreateRequestCardLambda',
            {
                ...sharedLambdaProps,
                functionName: `create-request-card-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/create-request-card/handler.ts'),
                handler: 'handler',
            },
        );

        // Trigger: main SQS queue — batch de hasta 10 mensajes
        this.createRequestCardLambda.addEventSource(
            new lambdaEvents.SqsEventSource(props.createRequestCardQueue, {
                batchSize: 10,
                reportBatchItemFailures: true, // habilita batchItemFailures
                maxBatchingWindow: cdk.Duration.seconds(5),
            }),
        );

        props.cardTable.grantWriteData(this.createRequestCardLambda);

        // permiso para leer user-table
        this.createRequestCardLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        // permiso para escribir en la cola de notificaciones
        this.createRequestCardLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );
        // ── card-activate ──────────────────────────────────────────────────────
        this.cardActivateLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardActivateLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-activate-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/card-activate/handler.ts'),
                handler: 'handler',
            },
        );

        props.cardTable.grantReadWriteData(this.cardActivateLambda);
        props.transactionTable.grantReadData(this.cardActivateLambda);

        // permiso para leer user-table
        this.cardActivateLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        // permiso para escribir en la cola de notificaciones
        this.cardActivateLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );
        // ── card-purchase ──────────────────────────────────────────────────────
        this.cardPurchaseLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardPurchaseLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-purchase-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/card-purchase/handler.ts'),
                handler: 'handler',
            },
        );

        props.cardTable.grantReadWriteData(this.cardPurchaseLambda);
        props.transactionTable.grantWriteData(this.cardPurchaseLambda);

        this.cardPurchaseLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        this.cardPurchaseLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );

        // ── card-transaction-save ──────────────────────────────────────────────
        this.cardTransactionSaveLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardTransactionSaveLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-transaction-save-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/card-transaction-save/handler.ts'),
                handler: 'handler',
            },
        );

        props.cardTable.grantReadWriteData(this.cardTransactionSaveLambda);
        props.transactionTable.grantWriteData(this.cardTransactionSaveLambda);

        this.cardTransactionSaveLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        this.cardTransactionSaveLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );

        // ── card-paid-credit-card ──────────────────────────────────────────────
        this.cardPaidCreditCardLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardPaidCreditCardLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-paid-credit-card-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/card-paid-credit-card/handler.ts'),
                handler: 'handler',
            },
        );

        props.cardTable.grantReadWriteData(this.cardPaidCreditCardLambda);
        props.transactionTable.grantWriteData(this.cardPaidCreditCardLambda);

        this.cardPaidCreditCardLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        this.cardPaidCreditCardLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );

        // ── card-get-report ────────────────────────────────────────────────────
        this.cardGetReportLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardGetReportLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-get-report-lambda-${props.stage}`,
                timeout: cdk.Duration.seconds(60), // más tiempo por generación de CSV + S3
                memorySize: 512,
                entry: path.join(__dirname, '../../src/lambdas/card-get-report/handler.ts'),
                handler: 'handler',
            },
        );

        props.cardTable.grantReadData(this.cardGetReportLambda);
        props.transactionTable.grantReadData(this.cardGetReportLambda);
        props.transactionsReportBucket.grantReadWrite(this.cardGetReportLambda);

        // Permiso para enviar emails con SES
        this.cardGetReportLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['dynamodb:GetItem', 'dynamodb:Query'],
                resources: [`arn:aws:dynamodb:us-east-1:${Stack.of(this).account}:table/user-table`],
            }),
        );

        this.cardGetReportLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['sqs:SendMessage'],
                resources: ['arn:aws:sqs:us-east-1:229711348724:notification-email-sqs'],
            }),
        );

        // ── card-request-failed (DLQ consumer) ────────────────────────────────
        this.cardRequestFailedLambda = new lambdaNodejs.NodejsFunction(
            this, 'CardRequestFailedLambda',
            {
                ...sharedLambdaProps,
                functionName: `card-request-failed-lambda-${props.stage}`,
                entry: path.join(__dirname, '../../src/lambdas/card-request-failed/handler.ts'),
                handler: 'handler',
            },
        );

        // Trigger: DLQ
        this.cardRequestFailedLambda.addEventSource(
            new lambdaEvents.SqsEventSource(props.errorCreateRequestCardQueue, {
                batchSize: 10,
                reportBatchItemFailures: true,
            }),
        );

        props.cardTableError.grantWriteData(this.cardRequestFailedLambda);
    }
}