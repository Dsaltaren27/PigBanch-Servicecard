export type CardStatus = "ACTIVATED" | "PENDING";
export type CardType = "DEBIT" | "CREDIT";
export interface Card {
    uuid: string;
    user_id: string;
    type: CardType;
    status: CardStatus;
    balance: number;
    createdAt: string;
}
export interface CreateCardInput {
    user_id: string;
    type: CardType;
    status: CardStatus;
    balance: number;
}
//# sourceMappingURL=card.model.d.ts.map