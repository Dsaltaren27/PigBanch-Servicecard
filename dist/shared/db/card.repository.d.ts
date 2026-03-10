import { Card, CreateCardInput, CardStatus } from '../models/card.model';
export declare class CardRepository {
    create(input: CreateCardInput): Promise<Card>;
    findById(uuid: string, createdAt: string): Promise<Card | null>;
    findByUuid(uuid: string): Promise<Card | null>;
    findByUserId(userId: string): Promise<Card[]>;
    findCreditCardByUserId(userId: string): Promise<Card | null>;
    updateStatus(uuid: string, createdAt: string, status: CardStatus): Promise<Card>;
    updateBalance(uuid: string, createdAt: string, newBalance: number): Promise<Card>;
}
//# sourceMappingURL=card.repository.d.ts.map