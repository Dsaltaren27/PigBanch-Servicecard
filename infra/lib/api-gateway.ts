import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface ApiGatewayProps {
    stage: string;
    cardActivateLambda: lambdaNodejs.NodejsFunction;
    cardPurchaseLambda: lambdaNodejs.NodejsFunction;
    cardTransactionSaveLambda: lambdaNodejs.NodejsFunction;
    cardPaidCreditCardLambda: lambdaNodejs.NodejsFunction;
    cardGetReportLambda: lambdaNodejs.NodejsFunction;
}

export class ApiGateway extends Construct {
    public readonly api: apigw.RestApi;

    constructor(scope: Construct, id: string, props: ApiGatewayProps) {
        super(scope, id);

        this.api = new apigw.RestApi(this, 'CardServiceApi', {
            restApiName: `card-service-api-${props.stage}`,
            description: 'Card service API Gateway',
            deployOptions: {
                stageName: props.stage,
                // Logs básicos por ruta
                loggingLevel: apigw.MethodLoggingLevel.ERROR,
                metricsEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });

        // ── /card ──────────────────────────────────────────────────────────────
        const card = this.api.root.addResource('card');

        // POST /card/activate
        const activate = card.addResource('activate');
        activate.addMethod(
            'POST',
            new apigw.LambdaIntegration(props.cardActivateLambda),
        );

        // /card/{card_id}
        const cardById = card.addResource('{card_id}');

        // GET /card/{card_id}
        cardById.addMethod(
            'GET',
            new apigw.LambdaIntegration(props.cardGetReportLambda),
        );

        // POST /card/paid/{card_id}
        const paid = card.addResource('paid');
        const paidById = paid.addResource('{card_id}');
        paidById.addMethod(
            'POST',
            new apigw.LambdaIntegration(props.cardPaidCreditCardLambda),
        );

        // ── /transactions ──────────────────────────────────────────────────────
        const transactions = this.api.root.addResource('transactions');

        // POST /transactions/purchase
        const purchase = transactions.addResource('purchase');
        purchase.addMethod(
            'POST',
            new apigw.LambdaIntegration(props.cardPurchaseLambda),
        );

        // POST /transactions/save/{card_id}
        const save = transactions.addResource('save');
        const saveById = save.addResource('{card_id}');
        saveById.addMethod(
            'POST',
            new apigw.LambdaIntegration(props.cardTransactionSaveLambda),
        );

        // Output: URL base del API
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.api.url,
            description: 'Card Service API Gateway URL',
            exportName: `card-service-api-url-${props.stage}`,
        });
    }
}