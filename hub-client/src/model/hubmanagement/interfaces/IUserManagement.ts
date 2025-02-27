// Responsibility of the hub administrator to manage rooms
export interface IUserManagement {
	showUserPermissions(userId: string): void;
	changePermission(userId: string, roomId: string, powerLevel: number): void;
	listUsers(from: string, to: string): void;
}
