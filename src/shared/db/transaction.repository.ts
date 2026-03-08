import {
    PutCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from './dynamo.client';
import { Transaction, CreateTransactionInput } from '../models/transaction.model';

const TABLE_NAME = process.env.TRANSACTION_TABLE_NAME ?? 'transaction-table';

export class TransactionRepository {
    // ─── CREATE ────────────────────────────────────────────────────────────────

    async create(input: CreateTransactionInput): Promise<Transaction> {
        const transaction: Transaction = {
            uuid: uuidv4(),
            cardId: input.cardId,
            amount: input.amount,
            merchant: input.merchant,
            type: input.type,
            createdAt: new Date().toISOString(),
        };

        await dynamoDb.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: transaction,
                ConditionExpression: 'attribute_not_exists(#uuid)',
                ExpressionAttributeNames: { '#uuid': 'uuid' },
            }),
        );

        return transaction;
    }

    // ─── COUNT BY CARD ID ──────────────────────────────────────────────────────
    // Used to validate if a credit card can be ACTIVATED (needs >= 10 transactions)

    async countByCardId(cardId: string): Promise<number> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'cardId-index',            // GSI: cardId (PK) + createdAt (SK)
                KeyConditionExpression: 'cardId = :cardId',
                ExpressionAttributeValues: { ':cardId': cardId },
                Select: 'COUNT',
            }),
        );

        return result.Count ?? 0;
    }

    // ─── QUERY BY CARD ID ──────────────────────────────────────────────────────

    async findByCardId(cardId: string): Promise<Transaction[]> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'cardId-index',
                KeyConditionExpression: 'cardId = :cardId',
                ExpressionAttributeValues: { ':cardId': cardId },
                ScanIndexForward: false,
            }),
        );

        return (result.Items as Transaction[]) ?? [];
    }

    // ─── QUERY BY CARD ID + DATE RANGE ─────────────────────────────────────────
    // Used by the report lambda to filter transactions in a period

    async findByCardIdAndDateRange(
        cardId: string,
        startDate: string,
        endDate: string,
    ): Promise<Transaction[]> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'cardId-index',
                KeyConditionExpression:
                    'cardId = :cardId AND createdAt BETWEEN :start AND :end',
                ExpressionAttributeValues: {
                    ':cardId': cardId,
                    ':start': startDate,
                    ':end': endDate,
                },
                ScanIndexForward: true, // ascending by date for reports
            }),
        );

        return (result.Items as Transaction[]) ?? [];
    }
}