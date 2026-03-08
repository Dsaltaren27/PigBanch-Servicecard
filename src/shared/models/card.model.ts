export interface Card {
	uuid: string;
	user_id: string;
	type: "DEBIT" | "CREDIT";
	status: "ACTIVATED" | "PENDING";
	balance: number;
	createdAt: string;
}