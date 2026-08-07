import { type MatrixEvent } from 'matrix-js-sdk';
import { type Ref, computed, reactive, unref } from 'vue';
import { useI18n } from 'vue-i18n';

import { createLogger } from '@hub-client/logic/logging/Logger';

import { type TExpertProfileContent, type TExpertVerificationMessageContent, type TExpertVerificationType } from '@hub-client/models/events/TExpertEvent';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { useDialog } from '@hub-client/stores/dialog';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { type Room, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Account data event type for expert profile
const EXPERT_PROFILE_EVENT_TYPE = 'pubhubs.expert_profile';

// Types

/**
 * Verification info for display.
 */
type TVerificationInfo = {
	eventId: string;
	expert_user_id: string;
	verification_type: TExpertVerificationType;
	credentials: string;
	specializations?: string[];
	verification_note?: string;
	sources?: string[];
	verified_at: number;
};

/**
 * @param room The room to act in; falls back to the room currently in view when omitted.
 */
function useExpertVerification(room?: Ref<Room | undefined> | Room) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const roomStore = useRooms();
	const dialogStore = useDialog();

	const { t } = useI18n();

	// Helpers
	const getCurrentRoom = () => unref(room) ?? roomStore.currentRoom;

	// Reactive state (per-component instance)
	const verifyDialog = reactive<{
		visible: boolean;
		roomId: string;
		eventId: string;
		// Initial values for editing
		initialVerificationType?: TExpertVerificationType;
		initialNote?: string;
		initialSources?: string[];
		error?: string;
	}>({
		visible: false,
		roomId: '',
		eventId: '',
		initialVerificationType: undefined,
		initialNote: undefined,
		initialSources: undefined,
		error: undefined,
	});

	const logger = createLogger('expert-verification');

	const expertProfileDialog = reactive<{
		visible: boolean;
		error?: string;
	}>({
		visible: false,
		error: undefined,
	});

	// Computed

	/**
	 * Check if current user is an expert in the current room based on power level.
	 * Expert power level is >= 25.
	 */
	const isCurrentUserExpert = computed((): boolean => {
		const userId = userStore.user?.userId;
		if (!userId) return false;

		const currentRoom = getCurrentRoom();
		if (!currentRoom) return false;

		const powerLevel = currentRoom.getPowerLevel(userId);
		return powerLevel >= UserPowerLevel.Expert;
	});

	// Functions

	/**
	 * Get all verification events for a message from the room's TimelineManager.
	 * Server-side spam checker enforces that only experts can send verification messages.
	 */
	const getVerificationEvents = (eventId: string): MatrixEvent[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];

		return currentRoom.getVerifications(eventId);
	};

	// Expert profile account data functions

	/**
	 * Get expert profile from account data for the current user.
	 */
	const getMyExpertProfile = async (): Promise<TExpertProfileContent | undefined> => {
		try {
			const event = pubhubsStore.client.getAccountData(EXPERT_PROFILE_EVENT_TYPE);
			if (!event) return undefined;
			return event.getContent() as TExpertProfileContent | undefined;
		} catch {
			// Account data not set yet
			return undefined;
		}
	};

	/**
	 * Set expert profile in account data for the current user.
	 */
	const setMyExpertProfile = async (profile: TExpertProfileContent): Promise<void> => {
		await pubhubsStore.client.setAccountData(EXPERT_PROFILE_EVENT_TYPE, profile);
	};

	/**
	 * Check if the current user has verified a specific message.
	 */
	const hasCurrentUserVerified = (eventId: string): boolean => {
		const userId = userStore.user?.userId;
		if (!userId) return false;

		const verifications = getVerificationEvents(eventId);
		return verifications.some((event) => event.getSender() === userId);
	};

	/**
	 * Get the current user's verification for a specific message.
	 */
	const getCurrentUserVerification = (eventId: string): TVerificationInfo | undefined => {
		const userId = userStore.user?.userId;
		if (!userId) return undefined;

		const verifications = getVerificationEvents(eventId);
		const userVerification = verifications.find((event) => event.getSender() === userId);
		if (!userVerification) return undefined;

		const content = userVerification.getContent() as TExpertVerificationMessageContent;
		return {
			eventId,
			expert_user_id: userId,
			verification_type: content.verification_type,
			credentials: content.credentials,
			specializations: content.specializations,
			verification_note: content.verification_note,
			sources: content.sources,
			verified_at: userVerification.getTs() ?? Date.now(),
		};
	};

	/**
	 * Get all verification info for a message (when multiple experts verified).
	 */
	const getAllVerificationInfo = (eventId: string): TVerificationInfo[] => {
		const verifications = getVerificationEvents(eventId);

		return verifications.map((event) => {
			const content = event.getContent() as TExpertVerificationMessageContent;
			const senderId = event.getSender();

			return {
				eventId,
				expert_user_id: senderId ?? '',
				verification_type: content.verification_type,
				credentials: content.credentials,
				specializations: content.specializations,
				verification_note: content.verification_note,
				sources: content.sources,
				verified_at: event.getTs() ?? Date.now(),
			};
		});
	};

	const verifyMessage = async (
		roomId: string,
		eventId: string,
		verificationType: TExpertVerificationType,
		verificationNote?: string,
		sources?: string[],
	): Promise<void> => {
		if (!isCurrentUserExpert.value) {
			throw new Error('User is not an expert in this room');
		}

		// Get credentials from current user's profile
		const profile = await getMyExpertProfile();
		if (!profile?.credentials) {
			throw new Error('Expert profile not set. Please set your credentials first.');
		}

		// Send verification message using the store method
		await pubhubsStore.addExpertVerificationMessage(
			roomId,
			eventId,
			verificationType,
			profile.credentials,
			profile.specializations,
			verificationNote,
			sources,
		);
	};

	const removeVerification = async (roomId: string, eventId: string): Promise<void> => {
		try {
			// Send unverify message using the store method
			await pubhubsStore.removeExpertVerificationMessage(roomId, eventId);
		} catch (error) {
			// Runs straight off the message context menu, so there is no dialog of ours to report in.
			logger.error('Failed to remove verification:', error);
			dialogStore.confirm(t('expert.remove_verification_failed'));
		}
	};

	const openVerifyDialog = (
		roomId: string,
		eventId: string,
		initialValues?: { verificationType?: TExpertVerificationType; note?: string; sources?: string[] },
	) => {
		verifyDialog.roomId = roomId;
		verifyDialog.eventId = eventId;
		verifyDialog.initialVerificationType = initialValues?.verificationType;
		verifyDialog.initialNote = initialValues?.note;
		verifyDialog.initialSources = initialValues?.sources;
		verifyDialog.error = undefined;
		verifyDialog.visible = true;
	};

	const closeVerifyDialog = () => {
		verifyDialog.visible = false;
		verifyDialog.roomId = '';
		verifyDialog.eventId = '';
		verifyDialog.initialVerificationType = undefined;
		verifyDialog.initialNote = undefined;
		verifyDialog.initialSources = undefined;
		verifyDialog.error = undefined;
	};

	const onVerifyDialogSubmit = async (verificationType: TExpertVerificationType, note?: string, sources?: string[]) => {
		// Clear the previous attempt's message, so a retry that fails again still reads as a change.
		verifyDialog.error = undefined;
		try {
			await verifyMessage(verifyDialog.roomId, verifyDialog.eventId, verificationType, note, sources);
			closeVerifyDialog();
		} catch (error) {
			logger.error('Failed to submit verification:', error);
			// Keep the dialog open so the user can retry, but say why it did not go through.
			verifyDialog.error = t('expert.verify_failed');
		}
	};

	const openExpertProfileDialog = () => {
		expertProfileDialog.error = undefined;
		expertProfileDialog.visible = true;
	};

	const closeExpertProfileDialog = () => {
		expertProfileDialog.visible = false;
		expertProfileDialog.error = undefined;
	};

	const onExpertProfileDialogSubmit = async (profile: TExpertProfileContent) => {
		expertProfileDialog.error = undefined;
		try {
			await setMyExpertProfile(profile);
			closeExpertProfileDialog();
		} catch (error) {
			logger.error('Failed to save expert profile:', error);
			// Keep the dialog open so the user can retry, but say why it did not go through.
			expertProfileDialog.error = t('expert.profile_save_failed');
		}
	};

	return {
		// Reactive state
		verifyDialog,
		expertProfileDialog,
		// Computed
		isCurrentUserExpert,
		// Profile functions
		getMyExpertProfile,
		setMyExpertProfile,
		// Functions
		hasCurrentUserVerified,
		getCurrentUserVerification,
		getAllVerificationInfo,
		verifyMessage,
		removeVerification,
		openVerifyDialog,
		closeVerifyDialog,
		onVerifyDialogSubmit,
		openExpertProfileDialog,
		closeExpertProfileDialog,
		onExpertProfileDialogSubmit,
	};
}

export { TVerificationInfo, useExpertVerification };
