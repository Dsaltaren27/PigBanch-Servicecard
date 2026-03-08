"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardErrorRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamo_client_1 = require("./dynamo.client");
const TABLE_NAME = process.env.CARD_TABLE_ERROR_NAME ?? 'card-table-error';
class CardErrorRepository {
    async create(input) {
        const record = {
            uuid: (0, uuid_1.v4)(),
            originalMessage: input.originalMessage,
            errorReason: input.errorReason,
            source: input.source,
            createdAt: new Date().toISOString(),
        };
        await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: record,
        }));
        return record;
    }
}
exports.CardErrorRepository = CardErrorRepository;
//# sourceMappingURL=card-error.repository.js.map