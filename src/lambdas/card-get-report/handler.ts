import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';  // ← reemplaza SES
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';
import { UserRepository } from '../../shared/db/user.repository';
import { Transaction } from '../../shared/models/transaction.model';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();
const userRepository = new UserRepository();
const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const sqs = new SQSClient({ region: 'us-east-1' }); // ← NUEVO

const BUCKET_NAME = process.env.TRANSACTIONS_REPORT_BUCKET ?? 'transactions-report-bucket';
const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';
const URL_EXPIRES_IN = 3600;

interface ReportQuery {
    start?: string;
    end?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // 1. Obtener card_id del path
        const cardId = event.pathParameters?.card_id;

        if (!cardId) {
            return response(400, { message: 'card_id is required in path' });
        }

        // 2. Validar query params
        const query = parseQuery(event.queryStringParameters);
        const validationError = validateQuery(query);

        if (validationError) {
            return response(400, { message: validationError });
        }

        // 3. Verificar que la tarjeta existe
        const card = await cardRepository.findByUuid(cardId);

        if (!card) {
            return response(404, { message: `Card not found: ${cardId}` });
        }

        // 4. Obtener transacciones en el rango de fechas
        const transactions = await transactionRepository.findByCardIdAndDateRange(
            cardId,
            query.start!,
            query.end!,
        );

        if (transactions.length === 0) {
            return response(404, {
                message: 'No transactions found for the given date range',
                start: query.start,
                end: query.end,
            });
        }

        // 5. Generar CSV
        const csv = generateCsv(transactions);
        const fileName = buildFileName(cardId, query.start!, query.end!);

        // 6. Subir a S3
        await uploadToS3(fileName, csv);

        // 7. Generar presigned URL
        const downloadUrl = await getPresignedUrl(fileName);

        // 8. ← NUEVO: enviar notificación por SQS
        await sendNotification(card.user_id, downloadUrl);

        return response(200, {
            message: 'Report generated successfully',
            downloadUrl,
            fileName,
            totalRecords: transactions.length,
            period: {
                start: query.start,
                end: query.end,
            },
        });

    } catch (error) {
        console.error('Error generating report:', error);
        return response(500, { message: 'Internal server error' });
    }
};

// ─── NUEVO: NOTIFICACIÓN SQS ──────────────────────────────────────────────────

async function sendNotification(userId: string, downloadUrl: string): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user?.email) {
        console.warn(`User email not found for userId: ${userId} — skipping notification`);
        return;
    }

    await sqs.send(new SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
            type: 'REPORT.ACTIVITY',
            email: user.email,
            data: {
                date: new Date().toISOString(),
                url: downloadUrl,
            },
        }),
    }));

    console.log(`Notification REPORT.ACTIVITY sent — userId: ${userId}, email: ${user.email}`);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function generateCsv(transactions: Transaction[]): string {
    const headers = ['uuid', 'cardId', 'amount', 'merchant', 'type', 'createdAt'];

    const rows = transactions.map((tx) =>
        [
            tx.uuid,
            tx.cardId,
            tx.amount,
            `"${tx.merchant.replace(/"/g, '""')}"`,
            tx.type,
            tx.createdAt,
        ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
}

// ─── S3 ───────────────────────────────────────────────────────────────────────

async function uploadToS3(fileName: string, content: string): Promise<void> {
    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: content,
            ContentType: 'text/csv',
        }),
    );
}

async function getPresignedUrl(fileName: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
    });

    return getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRES_IN });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseQuery(
    params: APIGatewayProxyEvent['queryStringParameters'],
): ReportQuery {
    if (!params) return {};
    return {
        start: params['start'] ?? undefined,
        end: params['end'] ?? undefined,
    };
}

function validateQuery(query: ReportQuery): string | null {
    if (!query.start) return 'start date is required as query param';
    if (!query.end) return 'end date is required as query param';

    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    if (isNaN(startDate.getTime())) return 'start is not a valid ISO date';
    if (isNaN(endDate.getTime())) return 'end is not a valid ISO date';
    if (startDate > endDate) return 'start date must be before end date';

    return null;
}

function buildFileName(cardId: string, start: string, end: string): string {
    const startSlug = start.split('T')[0];
    const endSlug = end.split('T')[0];
    return `reports/${cardId}/${startSlug}_${endSlug}_${Date.now()}.csv`;
}

function response(statusCode: number, body: object): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}