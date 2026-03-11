import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from './dynamo.client';

const TABLE_NAME = process.env.USER_TABLE_NAME ?? 'user-table';

export interface User {
    uuid: string;
    email: string;
    createdAt: string;
}

export class UserRepository {

    // Buscar por PK directa si tienes el uuid
    async findById(uuid: string): Promise<User | null> {
        const result = await dynamoDb.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: '#uuid = :uuid',
                ExpressionAttributeNames: { '#uuid': 'uuid' },
                ExpressionAttributeValues: { ':uuid': uuid },
                Limit: 1,
            }),
        );

        const items = result.Items as User[];
        return items?.length > 0 ? items[0] : null;
    }
}