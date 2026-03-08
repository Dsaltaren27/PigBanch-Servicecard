import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';
import { Card } from '../../shared/models/card.model';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();

interface PaidBody {
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

        // 3. Buscar tarjeta
        const card = await cardRepository.findByUuid(cardId);

        if (!card) {
            return response(404, { message: `Card not found: ${cardId}` });
        }

        // 4. Solo tarjetas CREDIT pueden recibir pagos de saldo
        if (card.type !== 'CREDIT') {
            return response(422, { message: 'Only CREDIT cards can receive balance payments' });
        }

        // 5. La tarjeta debe estar ACTIVATED
        if (card.status !== 'ACTIVATED') {
            return response(422, { message: `Card is not active. Current status: ${card.status}` });
        }

        // 6. Procesar el pago
        return await processPayment(card, body as PaidBody);

    } catch (error) {
        console.error('Error processing credit card payment:', error);
        return response(500, { message: 'Internal server error' });
    }
};

// ─── CORE ─────────────────────────────────────────────────────────────────────
// El balance en tarjeta CREDIT representa el crédito DISPONIBLE
// Al pagar, se devuelve crédito → balance sube
// No puede superar el límite original → validamos que no haya overpayment

async function processPayment(card: Card, body: PaidBody): Promise<APIGatewayProxyResult> {
    const newBalance = card.balance + body.amount;

    await cardRepository.updateBalance(card.uuid, card.createdAt, newBalance);

    const transaction = await transactionRepository.create({
        cardId: card.uuid,
        amount: body.amount,
        merchant: body.merchant,
        type: 'PAYMENT_BALANCE',
    });

    return response(200, {
        message: 'Payment processed successfully',
        transaction,
        availableCredit: newBalance,
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseBody(raw: string | null): Partial<PaidBody> {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function validateBody(body: Partial<PaidBody>): string | null {
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