import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from './dynamo.client';

const TABLE_NAME = process.env.CARD_TABLE_ERROR_NAME ?? 'card-table-error';

export interface CardErrorRecord {
    uuid: string;
    originalMessage: string;
    errorReason: string;
    source: string;
    createdAt: string;
}

export interface CreateCardErrorInput {
    originalMessage: string;
    errorReason: string;
    source: string;
}

export class CardErrorRepository {
    async create(input: CreateCardErrorInput): Promise<CardErrorRecord> {
        const record: CardErrorRecord = {
            uuid: uuidv4(),
            originalMessage: input.originalMessage,
            errorReason: input.errorReason,
            source: input.source,
            createdAt: new Date().toISOString(),
        };

        await dynamoDb.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: record,
            }),
        );

        return record;
    }
}