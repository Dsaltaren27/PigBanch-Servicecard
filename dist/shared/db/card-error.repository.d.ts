export interface CardErrorRecord {
    uuid: string;
    originalMessage: string;
    errorReason: string;
    source: string;
    createdAt: string;
}
export interface CreateCardErrorInput {
    originalMessage: string;
    errorReason: string;
    source: string;
}
export declare class CardErrorRepository {
    create(input: CreateCardErrorInput): Promise<CardErrorRecord>;
}
//# sourceMappingURL=card-error.repository.d.ts.map