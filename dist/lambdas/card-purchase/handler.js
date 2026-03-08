"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const card_repository_1 = require("../../shared/db/card.repository");
const transaction_repository_1 = require("../../shared/db/transaction.repository");
const cardRepository = new card_repository_1.CardRepository();
const transactionRepository = new transaction_repository_1.TransactionRepository();
const handler = async (event) => {
    try {
        const body = parseBody(event.body);
        const validationError = validateBody(body);
        if (validationError) {
            return response(400, { message: validationError });
        }
        // 1. Buscar la tarjeta
        const card = await cardRepository.findByUuid(body.cardId);
        if (!card) {
            return response(404, { message: `Card not found: ${body.cardId}` });
        }
        // 2. Validar que la tarjeta esté ACTIVATED
        if (card.status !== 'ACTIVATED' && card.type === 'DEBIT') {
            return response(422, { message: `Card is not active. Current status: ${card.status}` });
        }
        // 3. Delegar lógica según tipo de tarjeta
        if (card.type === 'DEBIT') {
            return await processDebitPurchase(card, body);
        }
        else {
            return await processCreditPurchase(card, body);
        }
    }
    catch (error) {
        console.error('Error processing purchase:', error);
        return response(500, { message: 'Internal server error' });
    }
};
exports.handler = handler;
// ─── DEBIT ────────────────────────────────────────────────────────────────────
// Valida que el saldo disponible sea suficiente, luego descuenta
async function processDebitPurchase(card, body) {
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
async function processCreditPurchase(card, body) {
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
function parseBody(raw) {
    if (!raw)
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function validateBody(body) {
    if (!body.cardId)
        return 'cardId is required';
    if (!body.merchant)
        return 'merchant is required';
    if (body.amount === undefined)
        return 'amount is required';
    if (typeof body.amount !== 'number')
        return 'amount must be a number';
    if (body.amount <= 0)
        return 'amount must be greater than 0';
    return null;
}
function response(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
//# sourceMappingURL=handler.js.map