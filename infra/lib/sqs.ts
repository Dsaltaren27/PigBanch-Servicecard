import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface SqsQueuesProps {
    stage: string;
}

export class SqsQueues extends Construct {
    public readonly createRequestCardQueue: sqs.Queue;
    public readonly errorCreateRequestCardQueue: sqs.Queue;

    constructor(scope: Construct, id: string, props: SqsQueuesProps) {
        super(scope, id);

        // ── DLQ ────────────────────────────────────────────────────────────────
        this.errorCreateRequestCardQueue = new sqs.Queue(this, 'ErrorCreateRequestCardQueue', {
            queueName: `error-create-request-card-sqs-${props.stage}`,
            retentionPeriod: cdk.Duration.days(14),  // guardar mensajes fallidos 14 días
            visibilityTimeout: cdk.Duration.seconds(30),
        });

        // ── Main queue ─────────────────────────────────────────────────────────
        this.createRequestCardQueue = new sqs.Queue(this, 'CreateRequestCardQueue', {
            queueName: `create-request-card-sqs-${props.stage}`,
            visibilityTimeout: cdk.Duration.seconds(30),
            retentionPeriod: cdk.Duration.days(4),
            deadLetterQueue: {
                queue: this.errorCreateRequestCardQueue,
                maxReceiveCount: 3,   // 3 intentos antes de ir al DLQ
            },
        });
    }
}