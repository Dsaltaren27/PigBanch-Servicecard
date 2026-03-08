import { SQSEvent, SQSRecord, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { CardRepository } from '../../shared/db/card.repository';
import { CreateCardSqsMessage } from '../../shared/models/sqs.model';
import { generateScore, calculateCreditLimit } from '../../shared/utils/score';

const cardRepository = new CardRepository();

// Triggered by SQS (create-request-card-sqs)
// Retorna batchItemFailures para que SQS sepa qué mensajes reintentar / enviar al DLQ
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
        try {
            await processRecord(record);
        } catch (error) {
            console.error(`Failed to process message ${record.messageId}:`, error);
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures };
};

// ─── PROCESS SINGLE RECORD ────────────────────────────────────────────────────

async function processRecord(record: SQSRecord): Promise<void> {
    const message = parseMessage(record.body);

    console.log(`Processing card request — userId: ${message.userId}, type: ${message.request}`);

    if (message.request === 'DEBIT') {
        await createDebitCard(message.userId);
    } else if (message.request === 'CREDIT') {
        await createCreditCard(message.userId);
    } else {
        throw new Error(`Unknown card request type: ${(message as any).request}`);
    }
}

// ─── DEBIT CARD ───────────────────────────────────────────────────────────────
// Status: ACTIVATED inmediatamente | Balance: 0

async function createDebitCard(userId: string): Promise<void> {
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

async function createCreditCard(userId: string): Promise<void> {
    const score = generateScore();
    const creditLimit = calculateCreditLimit(score);

    const card = await cardRepository.create({
        user_id: userId,
        type: 'CREDIT',
        status: 'PENDING',
        balance: creditLimit,
    });

    console.log(
        `Credit card created — uuid: ${card.uuid}, userId: ${userId}, score: ${score}, limit: ${creditLimit}`,
    );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseMessage(body: string): CreateCardSqsMessage {
    try {
        return JSON.parse(body) as CreateCardSqsMessage;
    } catch {
        throw new Error(`Invalid SQS message body — not valid JSON: ${body}`);
    }
}