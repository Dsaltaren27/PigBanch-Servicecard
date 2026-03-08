import * as cdk from 'aws-cdk-lib';
import { CardServiceStack } from '../lib/card-service-stack';

const app = new cdk.App();

// Deploy por stage — pasar: cdk deploy -c stage=dev
const stage = app.node.tryGetContext('stage') ?? 'dev';

new CardServiceStack(app, `CardServiceStack-${stage}`, {
    stage,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
    },
    tags: {
        project: 'card-service',
        stage,
    },
});