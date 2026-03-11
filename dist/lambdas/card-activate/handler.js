"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const card_repository_1 = require("../../shared/db/card.repository");
const transaction_repository_1 = require("../../shared/db/transaction.repository");
const user_repository_1 = require("../../shared/db/user.repository"); // ← NUEVO
const cardRepository = new card_repository_1.CardRepository();
const transactionRepository = new transaction_repository_1.TransactionRepository();
const userRepository = new user_repository_1.UserRepository(); // ← NUEVO
const sqs = new client_sqs_1.SQSClient({ region: 'us-east-1' });
const REQUIRED_TRANSACTIONS = 10;
const NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/229711348724/notification-email-sqs';
const handler = async (event) => {
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
        // 3. Contar transacciones de la tarjeta
        const transactionCount = await transactionRepository.countByCardId(card.uuid);
        if (transactionCount < REQUIRED_TRANSACTIONS) {
            return response(422, {
                message: `Card cannot be activated yet. Requires ${REQUIRED_TRANSACTIONS} transactions, currently has ${transactionCount}.`,
                current: transactionCount,
                required: REQUIRED_TRANSACTIONS,
            });
        }
        // 4. Activar la tarjeta
        const updatedCard = await cardRepository.updateStatus(card.uuid, card.createdAt, 'ACTIVATED');
        // 5. Buscar email del usuario en user-table ← NUEVO
        const user = await userRepository.findById(body.userId);
        if (!user?.email) {
            console.warn(`User email not found for userId: ${body.userId} — skipping notification`);
        }
        else {
            // 6. Enviar notificación a la cola SQS ← NUEVO
            await sqs.send(new client_sqs_1.SendMessageCommand({
                QueueUrl: NOTIFICATION_QUEUE_URL,
                MessageBody: JSON.stringify({
                    type: 'CARD.ACTIVATE',
                    email: user.email,
                    data: {
                        date: new Date().toISOString(),
                        type: updatedCard.type, // "CREDIT"
                        amount: updatedCard.balance, // límite disponible
                    },
                }),
            }));
            console.log(`Notification sent for userId: ${body.userId}, email: ${user.email}`);
        }
        return response(200, {
            message: 'Credit card activated successfully',
            card: updatedCard,
        });
    }
    catch (error) {
        console.error('Error activating card:', error);
        return response(500, { message: 'Internal server error' });
    }
};
exports.handler = handler;
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseBody(body) {
    if (!body)
        return {};
    try {
        return JSON.parse(body);
    }
    catch {
        return {};
    }
}
function response(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
//# sourceMappingURL=handler.js.map