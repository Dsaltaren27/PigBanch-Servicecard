import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';
import { Card } from '../../shared/models/card.model';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();

interface PurchaseBody {
    merchant: string;
    cardId: string;
    amount: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = parseBody(event.body);
        const validationError = validateBody(body);

        if (validationError) {
            return response(400, { message: validationError });
        }

        // 1. Buscar la tarjeta
        const card = await cardRepository.findByUuid(body.cardId!);

        if (!card) {
            return response(404, { message: `Card not found: ${body.cardId}` });
        }

        // 2. Validar que la tarjeta esté ACTIVATED
        if (card.status !== 'ACTIVATED' && card.type === 'DEBIT') {
            return response(422, { message: `Card is not active. Current status: ${card.status}` });
        }

        // 3. Delegar lógica según tipo de tarjeta
        if (card.type === 'DEBIT') {
            return await processDebitPurchase(card, body as PurchaseBody);
        } else {
            return await processCreditPurchase(card, body as PurchaseBody);
        }

    } catch (error) {
        console.error('Error processing purchase:', error);
        return response(500, { message: 'Internal server error' });
    }
};

// ─── DEBIT ────────────────────────────────────────────────────────────────────
// Valida que el saldo disponible sea suficiente, luego descuenta

async function processDebitPurchase(card: Card, body: PurchaseBody): Promise<APIGatewayProxyResult> {
    if (card.balance < body.amount) {
        return response(422, {
            message: 'Insufficient balance',
            available: card.balance,
            required: body.amount,
        });
    }

    const newBalance = card.balance - body.amount;

    await cardRepository.updateBalance(card.uuid, card.createdAt, newBalance);

    const transaction = await transactionRepository.create({
        cardId: card.uuid,
        amount: body.amount,
        merchant: body.merchant,
        type: 'PURCHASE',
    });

    return response(200, {
        message: 'Purchase completed successfully',
        transaction,
        balance: newBalance,
    });
}

// ─── CREDIT ───────────────────────────────────────────────────────────────────
// balance = crédito disponible (lo que queda por usar)
// Valida que el monto no exceda el crédito disponible

async function processCreditPurchase(card: Card, body: PurchaseBody): Promise<APIGatewayProxyResult> {
    if (card.balance < body.amount) {
        return response(422, {
            message: 'Credit limit exceeded',
            availableCredit: card.balance,
            required: body.amount,
        });
    }

    const newBalance = card.balance - body.amount;

    await cardRepository.updateBalance(card.uuid, card.createdAt, newBalance);

    const transaction = await transactionRepository.create({
        cardId: card.uuid,
        amount: body.amount,
        merchant: body.merchant,
        type: 'PURCHASE',
    });

    return response(200, {
        message: 'Purchase completed successfully',
        transaction,
        availableCredit: newBalance,
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseBody(raw: string | null): Partial<PurchaseBody> {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function validateBody(body: Partial<PurchaseBody>): string | null {
    if (!body.cardId) return 'cardId is required';
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