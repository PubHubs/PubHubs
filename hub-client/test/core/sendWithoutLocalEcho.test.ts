// Packages
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { api_matrix } from '@hub-client/logic/core/api';
import { APIService } from '@hub-client/logic/core/apiService';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

const ROOM_ID = '!room:example.org';
const TARGET_EVENT_ID = '$target:example.org';

/**
 * The relation messages PubHubs reads back off the timeline itself must not go through the SDK's
 * local-echo path. `Room.handleRemoteEcho` clears the echo's status unconditionally but only
 * re-registers it in the room timeline when `Room.eventShouldLiveIn` says the event belongs there,
 * and for an `m.relates_to` event that check follows the target message. Relating to a thread reply,
 * or to a message no longer in the loaded timeline, therefore left the echo in no timeline and the
 * SDK threw "updatePendingEventStatus called on an event which is not a local echo".
 */
describe('relation messages are sent without a local echo', () => {
	let pubhubs: ReturnType<typeof usePubhubsStore>;
	let sendMessage: ReturnType<typeof vi.fn>;
	let sendRoomMessage: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setActivePinia(createPinia());
		pubhubs = usePubhubsStore();
		sendMessage = vi.fn();
		pubhubs.client = {
			makeTxnId: () => 'txn-1',
			sendMessage,
		} as unknown as typeof pubhubs.client;
		sendRoomMessage = vi.spyOn(APIService, 'sendRoomMessage').mockResolvedValue({ event_id: '$sent:example.org' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const contentOf = (call: number) => sendRoomMessage.mock.calls[call][1] as Record<string, unknown>;

	test('an expert verification goes through the api service, not sendMessage', async () => {
		await pubhubs.addExpertVerificationMessage(ROOM_ID, TARGET_EVENT_ID, 'verified', 'Prof. of Testing');

		expect(sendMessage).not.toHaveBeenCalled();
		expect(sendRoomMessage).toHaveBeenCalledOnce();
		expect(sendRoomMessage.mock.calls[0][0]).toEqual(ROOM_ID);
		// The txn id comes off the SDK client, so it cannot collide with the SDK's own sends.
		expect(sendRoomMessage.mock.calls[0][2]).toEqual('txn-1');

		// The relation still goes out on the wire: TimelineManager keys the badges off it.
		expect(contentOf(0)['m.relates_to']).toEqual({ rel_type: 'pubhubs.expert_verify', event_id: TARGET_EVENT_ID });
		expect(contentOf(0).msgtype).toEqual('pubhubs.expert_verification');
	});

	test('removing an expert verification goes through the api service', async () => {
		await pubhubs.removeExpertVerificationMessage(ROOM_ID, TARGET_EVENT_ID);

		expect(sendMessage).not.toHaveBeenCalled();
		expect(contentOf(0)['m.relates_to']).toEqual({ rel_type: 'pubhubs.expert_unverify', event_id: TARGET_EVENT_ID });
	});

	// Same shape, same exposure: hiding a message in a thread hit the identical SDK trap.
	test('hiding a message goes through the api service', async () => {
		await pubhubs.addVisibilityMessage(ROOM_ID, TARGET_EVENT_ID, true, 'spam');

		expect(sendMessage).not.toHaveBeenCalled();
		expect(contentOf(0)['m.relates_to']).toEqual({ rel_type: 'hide', event_id: TARGET_EVENT_ID });
		expect(contentOf(0).ph_hidden_label).toEqual('spam');
	});

	test('unhiding a message goes through the api service', async () => {
		await pubhubs.addVisibilityMessage(ROOM_ID, TARGET_EVENT_ID, false);

		expect(sendMessage).not.toHaveBeenCalled();
		expect(contentOf(0)['m.relates_to']).toEqual({ rel_type: 'unhide', event_id: TARGET_EVENT_ID });
	});

	test('a rejected send still reaches the caller', async () => {
		sendRoomMessage.mockRejectedValue(new Error('boom'));

		// The composables report failures to the user, so the rejection must not be swallowed here.
		await expect(pubhubs.addExpertVerificationMessage(ROOM_ID, TARGET_EVENT_ID, 'verified', 'Prof. of Testing')).rejects.toThrow('boom');
	});
});

describe('APIService.sendRoomMessage', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('puts to the room send endpoint', async () => {
		const apiPUT = vi.spyOn(api_matrix, 'apiPUT').mockResolvedValue({ event_id: '$sent:example.org' });

		await APIService.sendRoomMessage(ROOM_ID, { msgtype: 'pubhubs.test', body: '' }, 'txn-1');

		// Room ids contain `!` and `:`, so they have to be escaped into the path.
		expect(apiPUT).toHaveBeenCalledWith(`${api_matrix.apiURLS.rooms}${encodeURIComponent(ROOM_ID)}/send/m.room.message/txn-1`, {
			msgtype: 'pubhubs.test',
			body: '',
		});
	});
});

describe('APIService.forceRoomJoin', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		api_matrix.setAccessToken('');
	});

	// api_matrix is shared, so an impersonated token left behind would send later room messages
	// - which now go over this very api - as that other admin.
	test('restores our own access token afterwards', async () => {
		api_matrix.setAccessToken('own-token');
		vi.spyOn(api_matrix, 'apiPOST').mockResolvedValue({});

		await APIService.forceRoomJoin(ROOM_ID, 'other-admin-token');

		expect(api_matrix.accessToken).toEqual('own-token');
	});

	test('restores our own access token even when the join fails', async () => {
		api_matrix.setAccessToken('own-token');
		vi.spyOn(api_matrix, 'apiPOST').mockRejectedValue(new Error('boom'));

		await expect(APIService.forceRoomJoin(ROOM_ID, 'other-admin-token')).rejects.toThrow('boom');

		expect(api_matrix.accessToken).toEqual('own-token');
	});
});
