export interface Transaction {
    uuid: string;
    cardId: string;
    amount: number;
    merchant: string;
    type: 'PURCHASE' | 'SAVING' | 'PAYMENT_BALANCE';
    createdAt: string;
}