export type CardRequestType = 'DEBIT' | 'CREDIT';

export interface CreateCardSqsMessage {
    userId: string;
    request: CardRequestType;
}