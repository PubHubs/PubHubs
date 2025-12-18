// Packages
import { RoomMember as MatrixRoomMember } from 'matrix-js-sdk';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

export type RoomMemberStateEvent = {
	type: string;
	sender: string;
	content: {
		displayname?: string;
		membership: string;
	};
	state_key: string;
	origin_server_ts: number;
	unsigned: {
		age: number;
	};
	event_id: string;
};

export default class RoomMember {
	private matrixRoomMember: MatrixRoomMember;

	public _avatarUrl?: string | null;

	constructor(matrixRoomMember: MatrixRoomMember) {
		this.matrixRoomMember = matrixRoomMember;
		this.updateAvatarUrl();
	}

	//#region Getters and setters
	public get userId(): string {
		return this.matrixRoomMember.userId;
	}

	public get name(): string {
		return this.matrixRoomMember.name;
	}

	public get avatarUrl(): string | undefined | null {
		return this._avatarUrl;
	}

	//#endregion

	private async updateAvatarUrl(): Promise<void> {
		const matrixFiles = useMatrixFiles();
		const avatarMxcUrl = this.matrixRoomMember.getMxcAvatarUrl();

		if (!avatarMxcUrl) {
			this._avatarUrl = null;
			return;
		}

		const avatarUrl = await matrixFiles.getAuthorizedMediaUrl(avatarMxcUrl);

		if (!avatarUrl) {
			throw new Error('Failed to retrieve avatar URL.');
		}

		this._avatarUrl = avatarUrl;
	}
}
