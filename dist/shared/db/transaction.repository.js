"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamo_client_1 = require("./dynamo.client");
const TABLE_NAME = process.env.TRANSACTION_TABLE_NAME ?? 'transaction-table';
class TransactionRepository {
    // ─── CREATE ────────────────────────────────────────────────────────────────
    async create(input) {
        const transaction = {
            uuid: (0, uuid_1.v4)(),
            cardId: input.cardId,
            amount: input.amount,
            merchant: input.merchant,
            type: input.type,
            createdAt: new Date().toISOString(),
        };
        await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: transaction,
            ConditionExpression: 'attribute_not_exists(#uuid)',
            ExpressionAttributeNames: { '#uuid': 'uuid' },
        }));
        return transaction;
    }
    // ─── COUNT BY CARD ID ──────────────────────────────────────────────────────
    // Used to validate if a credit card can be ACTIVATED (needs >= 10 transactions)
    async countByCardId(cardId) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'cardId-index', // GSI: cardId (PK) + createdAt (SK)
            KeyConditionExpression: 'cardId = :cardId',
            ExpressionAttributeValues: { ':cardId': cardId },
            Select: 'COUNT',
        }));
        return result.Count ?? 0;
    }
    // ─── QUERY BY CARD ID ──────────────────────────────────────────────────────
    async findByCardId(cardId) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'cardId-index',
            KeyConditionExpression: 'cardId = :cardId',
            ExpressionAttributeValues: { ':cardId': cardId },
            ScanIndexForward: false,
        }));
        return result.Items ?? [];
    }
    // ─── QUERY BY CARD ID + DATE RANGE ─────────────────────────────────────────
    // Used by the report lambda to filter transactions in a period
    async findByCardIdAndDateRange(cardId, startDate, endDate) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'cardId-index',
            KeyConditionExpression: 'cardId = :cardId AND createdAt BETWEEN :start AND :end',
            ExpressionAttributeValues: {
                ':cardId': cardId,
                ':start': startDate,
                ':end': endDate,
            },
            ScanIndexForward: true, // ascending by date for reports
        }));
        return result.Items ?? [];
    }
}
exports.TransactionRepository = TransactionRepository;
//# sourceMappingURL=transaction.repository.js.map