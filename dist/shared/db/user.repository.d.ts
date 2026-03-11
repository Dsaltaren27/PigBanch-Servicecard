export interface User {
    uuid: string;
    email: string;
    createdAt: string;
}
export declare class UserRepository {
    findById(uuid: string): Promise<User | null>;
}
//# sourceMappingURL=user.repository.d.ts.map