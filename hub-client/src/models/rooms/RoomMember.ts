// Packages
import { RoomMember as MatrixRoomMember } from 'matrix-js-sdk';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Stores
import { PubHubsStore, usePubhubsStore } from '@hub-client/stores/pubhubs';
import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

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

	// Stores
	private pubhubsStore: PubHubsStore;

	public _avatarUrl?: string | null;

	constructor(matrixRoomMember: MatrixRoomMember) {
		this.matrixRoomMember = matrixRoomMember;

		this.pubhubsStore = usePubhubsStore();

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
		const settings = useSettings();
		const avatarMxcUrl = this.matrixRoomMember.getMxcAvatarUrl();

		if (!avatarMxcUrl) {
			this._avatarUrl = null;
			return;
		}

		const useAuthMedia = settings.isFeatureEnabled(FeatureFlag.authenticatedMedia);
		const url = matrixFiles.formUrlfromMxc(avatarMxcUrl, useAuthMedia);
		const avatarUrl = useAuthMedia ? await this.pubhubsStore.getAuthorizedMediaUrl(url) : url;

		if (!avatarUrl) {
			throw new Error('Failed to retrieve avatar URL.');
		}

		this._avatarUrl = avatarUrl;
	}
}
