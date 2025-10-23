export interface IAccessListManagement {
	addToAccessList(email: string): void;
	removeFromAccessList(email: string): void;
}
