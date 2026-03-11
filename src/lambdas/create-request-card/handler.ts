import { SQSEvent, SQSRecord, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';  // ← NUEVO
import { CardRepository } from '../../shared/db/card.repository';
import { CreateCardSqsMessage } from '../../shared/models/sqs.model';
import { generateScore, calculateCreditLimit } from '../../shared/utils/score';
import { UserRepository } from '../../shared/db/user.repository';     // ← NUEVO
import { Card } from '../../shared/models/card.model';

const cardRepository = new CardRepository();
const userRepository = new UserRepository();                           // ← NUEVO
const sqs = new SQSClient({ region: 'us-east-1' });        // ← NUEVO

const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';

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

async function createDebitCard(userId: string): Promise<void> {
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

    // ← NUEVO: enviar notificación
    await sendNotification(userId, card);
}

// ─── NUEVO: NOTIFICACIÓN SQS ──────────────────────────────────────────────────

async function sendNotification(userId: string, card: Card): Promise<void> {
    // Buscar email del usuario en user-table
    const user = await userRepository.findById(userId);

    if (!user?.email) {
        console.warn(`User email not found for userId: ${userId} — skipping notification`);
        return;
    }

    await sqs.send(new SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
            type: 'CARD.CREATE',
            email: user.email,
            data: {
                date: new Date().toISOString(),
                type: card.type,    // "CREDIT" o "DEBIT"
                amount: card.balance, // límite asignado
            },
        }),
    }));

    console.log(`Notification CARD.CREATE sent — userId: ${userId}, email: ${user.email}, cardType: ${card.type}`);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseMessage(body: string): CreateCardSqsMessage {
    try {
        return JSON.parse(body) as CreateCardSqsMessage;
    } catch {
        throw new Error(`Invalid SQS message body — not valid JSON: ${body}`);
    }
}