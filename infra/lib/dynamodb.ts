import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoTablesProps {
    stage: string;
}

export class DynamoTables extends Construct {
    public readonly cardTable: dynamodb.Table;
    public readonly transactionTable: dynamodb.Table;
    public readonly cardTableError: dynamodb.Table;

    constructor(scope: Construct, id: string, props: DynamoTablesProps) {
        super(scope, id);

        // ── card-table ─────────────────────────────────────────────────────────
        this.cardTable = new dynamodb.Table(this, 'CardTable', {
            tableName: `card-table-${props.stage}`,
            partitionKey: { name: 'uuid', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
        });

        // GSI: buscar tarjetas por userId
        this.cardTable.addGlobalSecondaryIndex({
            indexName: 'user_id-index',
            partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // ── transaction-table ──────────────────────────────────────────────────
        this.transactionTable = new dynamodb.Table(this, 'TransactionTable', {
            tableName: `transaction-table-${props.stage}`,
            partitionKey: { name: 'uuid', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
        });

        // GSI: buscar transacciones por cardId + rango de fechas
        this.transactionTable.addGlobalSecondaryIndex({
            indexName: 'cardId-index',
            partitionKey: { name: 'cardId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // ── card-table-error ───────────────────────────────────────────────────
        this.cardTableError = new dynamodb.Table(this, 'CardTableError', {
            tableName: `card-table-error-${props.stage}`,
            partitionKey: { name: 'uuid', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
        });
    }
}