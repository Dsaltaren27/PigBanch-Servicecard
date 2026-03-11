"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sqs_1 = require("@aws-sdk/client-sqs"); // ← reemplaza SES
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const card_repository_1 = require("../../shared/db/card.repository");
const transaction_repository_1 = require("../../shared/db/transaction.repository");
const user_repository_1 = require("../../shared/db/user.repository");
const cardRepository = new card_repository_1.CardRepository();
const transactionRepository = new transaction_repository_1.TransactionRepository();
const userRepository = new user_repository_1.UserRepository();
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const sqs = new client_sqs_1.SQSClient({ region: 'us-east-1' }); // ← NUEVO
const BUCKET_NAME = process.env.TRANSACTIONS_REPORT_BUCKET ?? 'transactions-report-bucket';
const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';
const URL_EXPIRES_IN = 3600;
const handler = async (event) => {
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
        const transactions = await transactionRepository.findByCardIdAndDateRange(cardId, query.start, query.end);
        if (transactions.length === 0) {
            return response(404, {
                message: 'No transactions found for the given date range',
                start: query.start,
                end: query.end,
            });
        }
        // 5. Generar CSV
        const csv = generateCsv(transactions);
        const fileName = buildFileName(cardId, query.start, query.end);
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
    }
    catch (error) {
        console.error('Error generating report:', error);
        return response(500, { message: 'Internal server error' });
    }
};
exports.handler = handler;
// ─── NUEVO: NOTIFICACIÓN SQS ──────────────────────────────────────────────────
async function sendNotification(userId, downloadUrl) {
    const user = await userRepository.findById(userId);
    if (!user?.email) {
        console.warn(`User email not found for userId: ${userId} — skipping notification`);
        return;
    }
    await sqs.send(new client_sqs_1.SendMessageCommand({
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
function generateCsv(transactions) {
    const headers = ['uuid', 'cardId', 'amount', 'merchant', 'type', 'createdAt'];
    const rows = transactions.map((tx) => [
        tx.uuid,
        tx.cardId,
        tx.amount,
        `"${tx.merchant.replace(/"/g, '""')}"`,
        tx.type,
        tx.createdAt,
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
}
// ─── S3 ───────────────────────────────────────────────────────────────────────
async function uploadToS3(fileName, content) {
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: content,
        ContentType: 'text/csv',
    }));
}
async function getPresignedUrl(fileName) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: URL_EXPIRES_IN });
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseQuery(params) {
    if (!params)
        return {};
    return {
        start: params['start'] ?? undefined,
        end: params['end'] ?? undefined,
    };
}
function validateQuery(query) {
    if (!query.start)
        return 'start date is required as query param';
    if (!query.end)
        return 'end date is required as query param';
    const startDate = new Date(query.start);
    const endDate = new Date(query.end);
    if (isNaN(startDate.getTime()))
        return 'start is not a valid ISO date';
    if (isNaN(endDate.getTime()))
        return 'end is not a valid ISO date';
    if (startDate > endDate)
        return 'start date must be before end date';
    return null;
}
function buildFileName(cardId, start, end) {
    const startSlug = start.split('T')[0];
    const endSlug = end.split('T')[0];
    return `reports/${cardId}/${startSlug}_${endSlug}_${Date.now()}.csv`;
}
function response(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
//# sourceMappingURL=handler.js.map