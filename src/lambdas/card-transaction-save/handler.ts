import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';
import { Card } from '../../shared/models/card.model';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();

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

        // 6. Sumar saldo y guardar transacción
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

    return response(200, {
        message: 'Deposit completed successfully',
        transaction,
        balance: newBalance,
    });
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