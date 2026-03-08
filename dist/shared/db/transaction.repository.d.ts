import { Transaction, CreateTransactionInput } from '../models/transaction.model';
export declare class TransactionRepository {
    create(input: CreateTransactionInput): Promise<Transaction>;
    countByCardId(cardId: string): Promise<number>;
    findByCardId(cardId: string): Promise<Transaction[]>;
    findByCardIdAndDateRange(cardId: string, startDate: string, endDate: string): Promise<Transaction[]>;
}
//# sourceMappingURL=transaction.repository.d.ts.map