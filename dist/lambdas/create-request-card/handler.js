"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs"); // ← NUEVO
const card_repository_1 = require("../../shared/db/card.repository");
const score_1 = require("../../shared/utils/score");
const user_repository_1 = require("../../shared/db/user.repository"); // ← NUEVO
const cardRepository = new card_repository_1.CardRepository();
const userRepository = new user_repository_1.UserRepository(); // ← NUEVO
const sqs = new client_sqs_1.SQSClient({ region: 'us-east-1' }); // ← NUEVO
const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';
const handler = async (event) => {
    const batchItemFailures = [];
    for (const record of event.Records) {
        try {
            await processRecord(record);
        }
        catch (error) {
            console.error(`Failed to process message ${record.messageId}:`, error);
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return { batchItemFailures };
};
exports.handler = handler;
// ─── PROCESS SINGLE RECORD ────────────────────────────────────────────────────
async function processRecord(record) {
    const message = parseMessage(record.body);
    console.log(`Processing card request — userId: ${message.userId}, type: ${message.request}`);
    if (message.request === 'DEBIT') {
        await createDebitCard(message.userId);
    }
    else if (message.request === 'CREDIT') {
        await createCreditCard(message.userId);
    }
    else {
        throw new Error(`Unknown card request type: ${message.request}`);
    }
}
// ─── DEBIT CARD ───────────────────────────────────────────────────────────────
async function createDebitCard(userId) {
    const card = await cardRepository.create({
        user_id: userId,
        type: 'DEBIT',
        status: 'ACTIVATED',
        balance: 0,
    });
    console.log(`Debit card created — uuid: ${card.uuid}, userId: ${userId}`);
    // ← NUEVO: enviar notificación
    await sendNotification(userId, card);
}
// ─── CREDIT CARD ──────────────────────────────────────────────────────────────
async function createCreditCard(userId) {
    const score = (0, score_1.generateScore)();
    const creditLimit = (0, score_1.calculateCreditLimit)(score);
    const card = await cardRepository.create({
        user_id: userId,
        type: 'CREDIT',
        status: 'PENDING',
        balance: creditLimit,
    });
    console.log(`Credit card created — uuid: ${card.uuid}, userId: ${userId}, score: ${score}, limit: ${creditLimit}`);
    // ← NUEVO: enviar notificación
    await sendNotification(userId, card);
}
// ─── NUEVO: NOTIFICACIÓN SQS ──────────────────────────────────────────────────
async function sendNotification(userId, card) {
    // Buscar email del usuario en user-table
    const user = await userRepository.findById(userId);
    if (!user?.email) {
        console.warn(`User email not found for userId: ${userId} — skipping notification`);
        return;
    }
    await sqs.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
            type: 'CARD.CREATE',
            email: user.email,
            data: {
                date: new Date().toISOString(),
                type: card.type, // "CREDIT" o "DEBIT"
                amount: card.balance, // límite asignado
            },
        }),
    }));
    console.log(`Notification CARD.CREATE sent — userId: ${userId}, email: ${user.email}, cardType: ${card.type}`);
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseMessage(body) {
    try {
        return JSON.parse(body);
    }
    catch {
        throw new Error(`Invalid SQS message body — not valid JSON: ${body}`);
    }
}
//# sourceMappingURL=handler.js.map