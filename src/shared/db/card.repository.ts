import {
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from './dynamo.client';
import { Card, CreateCardInput, CardStatus } from '../models/card.model';

const TABLE_NAME = process.env.CARD_TABLE_NAME ?? 'card-table';

export class CardRepository {
    // ─── CREATE ────────────────────────────────────────────────────────────────

    async create(input: CreateCardInput): Promise<Card> {
        const card: Card = {
            uuid: uuidv4(),
            user_id: input.user_id,
            type: input.type,
            status: input.status,
            balance: input.balance,
            createdAt: new Date().toISOString(),
        };

        await dynamoDb.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: card,
                ConditionExpression: 'attribute_not_exists(#uuid)',
                ExpressionAttributeNames: { '#uuid': 'uuid' },
            }),
        );

        return card;
    }

    // ─── GET BY ID ─────────────────────────────────────────────────────────────

    async findById(uuid: string, createdAt: string): Promise<Card | null> {
        const result = await dynamoDb.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { uuid, createdAt },
            }),
        );

        return (result.Item as Card) ?? null;
    }

    // ─── QUERY BY UUID (only PK, gets latest) ──────────────────────────────────

    async findByUuid(uuid: string): Promise<Card | null> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: '#uuid = :uuid',
                ExpressionAttributeNames: { '#uuid': 'uuid' },
                ExpressionAttributeValues: { ':uuid': uuid },
                ScanIndexForward: false, // descending → most recent first
                Limit: 1,
            }),
        );

        const items = result.Items as Card[];
        return items?.length > 0 ? items[0] : null;
    }

    // ─── QUERY BY USER ID (requires GSI) ───────────────────────────────────────

    async findByUserId(userId: string): Promise<Card[]> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'user_id-index',          // GSI: user_id (PK) + createdAt (SK)
                KeyConditionExpression: 'user_id = :userId',
                ExpressionAttributeValues: { ':userId': userId },
                ScanIndexForward: false,
            }),
        );

        return (result.Items as Card[]) ?? [];
    }

    // ─── FIND ACTIVE CREDIT CARD BY USER ───────────────────────────────────────

    async findCreditCardByUserId(userId: string): Promise<Card | null> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'user_id-index',
                KeyConditionExpression: 'user_id = :userId',
                FilterExpression: '#type = :type',
                ExpressionAttributeNames: { '#type': 'type' },
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':type': 'CREDIT',
                },
                ScanIndexForward: false,
                Limit: 1,
            }),
        );

        const items = result.Items as Card[];
        return items?.length > 0 ? items[0] : null;
    }

    // ─── UPDATE STATUS ─────────────────────────────────────────────────────────

    async updateStatus(
        uuid: string,
        createdAt: string,
        status: CardStatus,
    ): Promise<Card> {
        const result = await dynamoDb.send(
            new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { uuid, createdAt },
                UpdateExpression: 'SET #status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#uuid': 'uuid',
                },
                ExpressionAttributeValues: {
                    ':status': status
                },
                ConditionExpression: 'attribute_exists(#uuid)',
                ReturnValues: 'ALL_NEW',
            }),
        );

        return result.Attributes as Card;
    }

    // ─── UPDATE BALANCE ────────────────────────────────────────────────────────

    async updateBalance(
        uuid: string,
        createdAt: string,
        newBalance: number,
    ): Promise<Card> {
        const result = await dynamoDb.send(
            new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { uuid, createdAt },
                UpdateExpression: 'SET balance = :balance',
                ExpressionAttributeValues: { ':balance': newBalance },
                ConditionExpression: 'attribute_exists(#uuid)',
                ExpressionAttributeNames: { '#uuid': 'uuid' },
                ReturnValues: 'ALL_NEW',
            }),
        );

        return result.Attributes as Card;
    }
}