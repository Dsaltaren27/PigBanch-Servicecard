import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';  // ← NUEVO
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';
import { UserRepository } from '../../shared/db/user.repository';     // ← NUEVO
import { Card } from '../../shared/models/card.model';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();
const userRepository = new UserRepository();                    // ← NUEVO
const sqs = new SQSClient({ region: 'us-east-1' }); // ← NUEVO

const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';

interface SaveBody {
    merchant: string;
    amount: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // 1. Obtener card_id del path
        const cardId = event.pathParameters?.card_id;

        if (!cardId) {
            return response(400, { message: 'card_id is required in path' });
        }

        // 2. Validar body
        const body = parseBody(event.body);
        const validationError = validateBody(body);

        if (validationError) {
            return response(400, { message: validationError });
        }

        // 3. Buscar la tarjeta
        const card = await cardRepository.findByUuid(cardId);

        if (!card) {
            return response(404, { message: `Card not found: ${cardId}` });
        }

        // 4. Solo tarjetas DEBIT pueden recibir depósitos
        if (card.type !== 'DEBIT') {
            return response(422, { message: 'Only DEBIT cards can receive savings deposits' });
        }

        // 5. La tarjeta debe estar ACTIVATED
        if (card.status !== 'ACTIVATED') {
            return response(422, { message: `Card is not active. Current status: ${card.status}` });
        }

        // 6. Procesar depósito
        return await processSaving(card, body as SaveBody);

    } catch (error) {
        console.error('Error saving transaction:', error);
        return response(500, { message: 'Internal server error' });
    }
};

// ─── CORE ─────────────────────────────────────────────────────────────────────

async function processSaving(card: Card, body: SaveBody): Promise<APIGatewayProxyResult> {
    const newBalance = card.balance + body.amount;

    await cardRepository.updateBalance(card.uuid, card.createdAt, newBalance);

    const transaction = await transactionRepository.create({
        cardId: card.uuid,
        amount: body.amount,
        merchant: body.merchant,
        type: 'SAVING',
    });

    // ← NUEVO: enviar notificación
    await sendNotification(card.user_id, body);

    return response(200, {
        message: 'Deposit completed successfully',
        transaction,
        balance: newBalance,
    });
}

// ─── NUEVO: NOTIFICACIÓN SQS ──────────────────────────────────────────────────

async function sendNotification(userId: string, body: SaveBody): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user?.email) {
        console.warn(`User email not found for userId: ${userId} — skipping notification`);
        return;
    }

    await sqs.send(new SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
            type: 'TRANSACTION.SAVE',
            email: user.email,
            data: {
                date: new Date().toISOString(),
                merchant: body.merchant, // "SAVING"
                amount: body.amount,
            },
        }),
    }));

    console.log(`Notification TRANSACTION.SAVE sent — userId: ${userId}, email: ${user.email}, amount: ${body.amount}`);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseBody(raw: string | null): Partial<SaveBody> {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function validateBody(body: Partial<SaveBody>): string | null {
    if (!body.merchant) return 'merchant is required';
    if (body.amount === undefined) return 'amount is required';
    if (typeof body.amount !== 'number') return 'amount must be a number';
    if (body.amount <= 0) return 'amount must be greater than 0';
    return null;
}

function response(statusCode: number, body: object): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}