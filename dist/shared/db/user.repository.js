"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamo_client_1 = require("./dynamo.client");
const TABLE_NAME = process.env.USER_TABLE_NAME ?? 'user-table';
class UserRepository {
    // Buscar por PK directa si tienes el uuid
    async findById(uuid) {
        const result = await dynamo_client_1.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: '#uuid = :uuid',
            ExpressionAttributeNames: { '#uuid': 'uuid' },
            ExpressionAttributeValues: { ':uuid': uuid },
            Limit: 1,
        }));
        const items = result.Items;
        return items?.length > 0 ? items[0] : null;
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user.repository.js.map