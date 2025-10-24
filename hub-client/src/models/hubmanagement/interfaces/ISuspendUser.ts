export interface ISuspendUser {
	banUser(userId: string): void;
	kickUser(userId: string): void;
}
