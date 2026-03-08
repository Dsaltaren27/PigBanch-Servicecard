export type TransactionType = 'PURCHASE' | 'SAVING' | 'PAYMENT_BALANCE';

export interface Transaction {
    uuid: string;
    cardId: string;
    amount: number;
    merchant: string;
    type: TransactionType;
    createdAt: string;
}

export interface CreateTransactionInput {
    cardId: string;
    amount: number;
    merchant: string;
    type: TransactionType;
}