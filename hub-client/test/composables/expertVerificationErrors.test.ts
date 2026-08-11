// Packages
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';

// Composables
import { useExpertVerification } from '@hub-client/composables/moderation/expert-verification.composable';

// Logic
import { setUpi18n } from '@hub-client/i18n';

// Models
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useDialog } from '@hub-client/stores/dialog';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

const ROOM_ID = '!expert:example.org';
const EVENT_ID = '$target:example.org';
const ME = '@me:example.org';

type Composable = ReturnType<typeof useExpertVerification>;

/**
 * The composable needs a component context (`useI18n`), so expose it through a throwaway component.
 */
const setup = () => {
	const i18n = setUpi18n();
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		initialState: {
			// The store's `user` getter resolves through the client and falls back to an anonymous
			// default user, so `getUser` has to answer or the expert power-level check never passes.
			user: { userId: ME, client: { getUser: () => ({ userId: ME }) } },
		},
	});

	const rooms = useRooms(pinia);
	// The composable resolves the room it acts in through the room store when passed nothing.
	rooms.rooms[ROOM_ID] = {
		roomId: ROOM_ID,
		// Expert power, so `verifyMessage` gets past its own guard and reaches the store call.
		getPowerLevel: () => UserPowerLevel.Expert,
		getVerifications: () => [],
	} as unknown as ReturnType<typeof useRooms>['rooms'][string];
	rooms.currentRoomId = ROOM_ID;

	const pubhubs = usePubhubsStore(pinia);
	// `verifyMessage` reads credentials off account data before sending; saving the profile writes them back.
	pubhubs.client = {
		getAccountData: () => ({ getContent: () => ({ credentials: 'Prof. of Testing' }) }),
		setAccountData: vi.fn(),
	} as unknown as typeof pubhubs.client;

	let composable!: Composable;
	const Host = defineComponent({
		setup() {
			composable = useExpertVerification();
			return () => null;
		},
	});

	mount(Host, { global: { plugins: [pinia, i18n] } });

	return { composable, pubhubs, dialog: useDialog(pinia) };
};

describe('expert verification failure reporting', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('a failed submit reports why and keeps the dialog open', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.addExpertVerificationMessage).mockRejectedValue(new Error('boom'));

		composable.openVerifyDialog(ROOM_ID, EVENT_ID);
		expect(composable.verifyDialog.error).toBeUndefined();

		await composable.onVerifyDialogSubmit('verified', 'a note');

		// Submitting used to fail silently, which reads as a dead button.
		expect(composable.verifyDialog.error).toBeTruthy();
		expect(composable.verifyDialog.visible).toBe(true);
		// The target is kept, so a retry from the still-open dialog goes to the same message.
		expect(composable.verifyDialog.eventId).toEqual(EVENT_ID);
	});

	test('a successful submit closes the dialog and leaves no error behind', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.addExpertVerificationMessage).mockResolvedValue(undefined);

		composable.openVerifyDialog(ROOM_ID, EVENT_ID);
		await composable.onVerifyDialogSubmit('verified', 'a note');

		expect(composable.verifyDialog.error).toBeUndefined();
		expect(composable.verifyDialog.visible).toBe(false);
	});

	test('a retry that succeeds clears the previous failure', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.addExpertVerificationMessage).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

		composable.openVerifyDialog(ROOM_ID, EVENT_ID);
		await composable.onVerifyDialogSubmit('verified', 'a note');
		expect(composable.verifyDialog.error).toBeTruthy();

		await composable.onVerifyDialogSubmit('verified', 'a note');

		expect(composable.verifyDialog.error).toBeUndefined();
		expect(composable.verifyDialog.visible).toBe(false);
	});

	test('reopening the dialog does not carry the previous failure over', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.addExpertVerificationMessage).mockRejectedValue(new Error('boom'));

		composable.openVerifyDialog(ROOM_ID, EVENT_ID);
		await composable.onVerifyDialogSubmit('verified', 'a note');
		expect(composable.verifyDialog.error).toBeTruthy();

		composable.closeVerifyDialog();
		composable.openVerifyDialog(ROOM_ID, EVENT_ID);

		expect(composable.verifyDialog.error).toBeUndefined();
	});

	// Removing runs off the message context menu, so there is no dialog of ours to report in.
	test('a failed removal reports through the shared dialog', async () => {
		const { composable, pubhubs, dialog } = setup();
		vi.mocked(pubhubs.removeExpertVerificationMessage).mockRejectedValue(new Error('boom'));

		await composable.removeVerification(ROOM_ID, EVENT_ID);

		expect(dialog.confirm).toHaveBeenCalledOnce();
	});

	test('a failed removal does not propagate to the caller', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.removeExpertVerificationMessage).mockRejectedValue(new Error('boom'));

		// The context menu calls this without awaiting; an unhandled rejection would surface as noise.
		await expect(composable.removeVerification(ROOM_ID, EVENT_ID)).resolves.toBeUndefined();
	});

	test('a failed profile save reports why and keeps the dialog open', async () => {
		const { composable, pubhubs } = setup();
		vi.mocked(pubhubs.client.setAccountData).mockRejectedValue(new Error('boom'));

		composable.openExpertProfileDialog();
		await composable.onExpertProfileDialogSubmit({ credentials: 'Prof. of Testing' });

		expect(composable.expertProfileDialog.error).toBeTruthy();
		expect(composable.expertProfileDialog.visible).toBe(true);
	});
});
