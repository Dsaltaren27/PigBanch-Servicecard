"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamo_client_1 = require("./dynamo.client");
const TABLE_NAME = process.env.CARD_TABLE_NAME ?? 'card-table';
class CardRepository {
    // ─── CREATE ────────────────────────────────────────────────────────────────
    async create(input) {
        const card = {
            uuid: (0, uuid_1.v4)(),
            user_id: input.user_id,
            type: input.type,
            status: input.status,
            balance: input.balance,
            createdAt: new Date().toISOString(),
        };
        await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: card,
            ConditionExpression: 'attribute_not_exists(#uuid)',
            ExpressionAttributeNames: { '#uuid': 'uuid' },
        }));
        return card;
    }
    // ─── GET BY ID ─────────────────────────────────────────────────────────────
    async findById(uuid, createdAt) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.GetCommand({
            TableName: TABLE_NAME,
            Key: { uuid, createdAt },
        }));
        return result.Item ?? null;
    }
    // ─── QUERY BY UUID (only PK, gets latest) ──────────────────────────────────
    async findByUuid(uuid) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: '#uuid = :uuid',
            ExpressionAttributeNames: { '#uuid': 'uuid' },
            ExpressionAttributeValues: { ':uuid': uuid },
            ScanIndexForward: false, // descending → most recent first
            Limit: 1,
        }));
        const items = result.Items;
        return items?.length > 0 ? items[0] : null;
    }
    // ─── QUERY BY USER ID (requires GSI) ───────────────────────────────────────
    async findByUserId(userId) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'user_id-index', // GSI: user_id (PK) + createdAt (SK)
            KeyConditionExpression: 'user_id = :userId',
            ExpressionAttributeValues: { ':userId': userId },
            ScanIndexForward: false,
        }));
        return result.Items ?? [];
    }
    // ─── FIND ACTIVE CREDIT CARD BY USER ───────────────────────────────────────
    async findCreditCardByUserId(userId) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
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
        }));
        const items = result.Items;
        return items?.length > 0 ? items[0] : null;
    }
    // ─── UPDATE STATUS ─────────────────────────────────────────────────────────
    async updateStatus(uuid, createdAt, status) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.UpdateCommand({
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
        }));
        return result.Attributes;
    }
    // ─── UPDATE BALANCE ────────────────────────────────────────────────────────
    async updateBalance(uuid, createdAt, newBalance) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.UpdateCommand({
            TableName: TABLE_NAME,
            Key: { uuid, createdAt },
            UpdateExpression: 'SET balance = :balance',
            ExpressionAttributeValues: { ':balance': newBalance },
            ConditionExpression: 'attribute_exists(#uuid)',
            ExpressionAttributeNames: { '#uuid': 'uuid' },
            ReturnValues: 'ALL_NEW',
        }));
        return result.Attributes;
    }
}
exports.CardRepository = CardRepository;
//# sourceMappingURL=card.repository.js.map