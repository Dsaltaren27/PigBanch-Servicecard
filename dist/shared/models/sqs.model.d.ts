export type CardRequestType = 'DEBIT' | 'CREDIT';
export interface CreateCardSqsMessage {
    userId: string;
    request: CardRequestType;
}
//# sourceMappingURL=sqs.model.d.ts.map