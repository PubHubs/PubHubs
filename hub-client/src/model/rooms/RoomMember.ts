import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
import { PubHubsStore, usePubHubs } from '@/logic/core/pubhubsStore';
import { FeatureFlag, useSettings } from '@/logic/store/settings';
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
