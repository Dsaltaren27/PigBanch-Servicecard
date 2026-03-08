"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const card_repository_1 = require("../../shared/db/card.repository");
const score_1 = require("../../shared/utils/score");
const cardRepository = new card_repository_1.CardRepository();
// Triggered by SQS (create-request-card-sqs)
// Retorna batchItemFailures para que SQS sepa qué mensajes reintentar / enviar al DLQ
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
// Status: ACTIVATED inmediatamente | Balance: 0
async function createDebitCard(userId) {
    const card = await cardRepository.create({
        user_id: userId,
        type: 'DEBIT',
        status: 'ACTIVATED',
        balance: 0,
    });
    console.log(`Debit card created — uuid: ${card.uuid}, userId: ${userId}`);
}
// ─── CREDIT CARD ──────────────────────────────────────────────────────────────
// Status: PENDING | Balance: límite calculado con score aleatorio
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