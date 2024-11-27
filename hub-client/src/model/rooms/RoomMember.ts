import { PubHubsStore, usePubHubs } from '@/core/pubhubsStore';
import { RoomMember as MatrixRoomMember } from 'matrix-js-sdk';

export default class RoomMember {
	private matrixRoomMember: MatrixRoomMember;

	// Stores
	private pubhubsStore: PubHubsStore;

	public _avatarUrl?: string | null;

	constructor(matrixRoomMember: MatrixRoomMember) {
		this.matrixRoomMember = matrixRoomMember;

		this.pubhubsStore = usePubHubs();

		this.updateAvatarUrl();
	}

	//#region Getters and setters
	public get userId(): string {
		return this.matrixRoomMember.userId;
	}

	public get avatarUrl(): string | undefined | null {
		return this._avatarUrl;
	}

	//#endregion

	private async updateAvatarUrl(): Promise<void> {
		const avatarMxcUrl = this.matrixRoomMember.getMxcAvatarUrl();
		if (!avatarMxcUrl) {
			this._avatarUrl = null;
			return;
		}

		const avatarUrl = await this.pubhubsStore.getAuthorizedMediaUrl(avatarMxcUrl);
		if (!avatarUrl) throw new Error('Failed to get authenticated avatar URL while avatar URL is defined.');

		this._avatarUrl = avatarUrl;
	}
}
