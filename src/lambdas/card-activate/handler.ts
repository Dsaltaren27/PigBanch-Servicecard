import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CardRepository } from '../../shared/db/card.repository';
import { TransactionRepository } from '../../shared/db/transaction.repository';

const cardRepository = new CardRepository();
const transactionRepository = new TransactionRepository();

const REQUIRED_TRANSACTIONS = 10;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = parseBody(event.body);

        if (!body.userId) {
            return response(400, { message: 'userId is required' });
        }

        // 1. Buscar la tarjeta CREDIT del usuario
        const card = await cardRepository.findCreditCardByUserId(body.userId);

        if (!card) {
            return response(404, { message: `No credit card found for userId: ${body.userId}` });
        }

        // 2. Validar que no esté ya activada
        if (card.status === 'ACTIVATED') {
            return response(409, { message: 'Credit card is already ACTIVATED' });
        }

// 3. Buscar la tarjeta DÉBITO del usuario y contar sus transacciones
        const userCards = await cardRepository.findByUserId(body.userId);
        const debitCard = userCards.find(c => c.type === 'DEBIT');

        if (!debitCard) {
            return response(404, { message: `No debit card found for userId: ${body.userId}` });
        }

        const transactionCount = await transactionRepository.countByCardId(debitCard.uuid);

        if (transactionCount < REQUIRED_TRANSACTIONS) {
            return response(422, {
                message: `Card cannot be activated yet. Requires ${REQUIRED_TRANSACTIONS} transactions, currently has ${transactionCount}.`,
                current: transactionCount,
                required: REQUIRED_TRANSACTIONS,
            });
        }

        // 4. Activar la tarjeta
        const updatedCard = await cardRepository.updateStatus(card.uuid, card.createdAt, 'ACTIVATED');

        return response(200, {
            message: 'Credit card activated successfully',
            card: updatedCard,
        });

    } catch (error) {
        console.error('Error activating card:', error);
        return response(500, { message: 'Internal server error' });
    }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseBody(body: string | null): { userId?: string } {
    if (!body) return {};
    try {
        return JSON.parse(body);
    } catch {
        return {};
    }
}

function response(statusCode: number, body: object): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}