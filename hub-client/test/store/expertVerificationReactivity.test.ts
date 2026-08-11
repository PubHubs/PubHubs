// Packages
import { createTestingPinia } from '@pinia/testing';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import { RelationType } from '@hub-client/models/constants';
import { TimelineManager } from '@hub-client/models/timeline/TimelineManager';

const ROOM_ID = '!expert:example.org';
const TARGET_EVENT_ID = '$target:example.org';
const EXPERT = '@expert:example.org';
const OTHER_EXPERT = '@other-expert:example.org';

/**
 * A verification (or unverification) message as it arrives over sync. Only the accessors
 * TimelineManager actually reads are stubbed.
 */
const verificationEvent = (opts: { sender: string; relType: string; ts: number; targetEventId?: string }): MatrixEvent =>
	({
		getSender: () => opts.sender,
		getTs: () => opts.ts,
		getContent: () => ({
			msgtype: PubHubsMgType.ExpertVerification,
			[RelationType.RelatesTo]: {
				rel_type: opts.relType,
				event_id: opts.targetEventId ?? TARGET_EVENT_ID,
			},
		}),
	}) as unknown as MatrixEvent;

/** `updateExpertVerificationEvent` is private; sync ingestion is the only production caller. */
const ingest = (manager: TimelineManager, event: MatrixEvent): void => {
	(manager as unknown as { updateExpertVerificationEvent(e: MatrixEvent): void }).updateExpertVerificationEvent(event);
};

describe('expert verification reactivity', () => {
	let manager: TimelineManager;

	beforeEach(() => {
		setActivePinia(createTestingPinia({ createSpy: vi.fn }));
		manager = new TimelineManager(ROOM_ID, {} as MatrixClient);
	});

	// The badges are rendered from a computed per message bubble. Those bubbles are keyed by event id
	// and hold on to the same TimelineEvent instance, so if the verification map is not reactive
	// nothing invalidates the computed and a verification never shows up on a message already on screen.
	test('a computed reading getVerifications re-evaluates when a verification arrives', () => {
		const senders = computed(() => manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getSender()));

		expect(senders.value).toEqual([]);

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 1000 }));

		expect(senders.value).toEqual([EXPERT]);
	});

	test('a second expert verifying the same message invalidates the computed', () => {
		const senders = computed(() => manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getSender()));

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 1000 }));
		expect(senders.value).toEqual([EXPERT]);

		ingest(manager, verificationEvent({ sender: OTHER_EXPERT, relType: RelationType.ExpertVerify, ts: 2000 }));

		expect(senders.value).toEqual([EXPERT, OTHER_EXPERT]);
	});

	// A re-verify replaces an entry in place, which is where mutating the stored array instead of
	// building a new one stops notifying watchers.
	test('an expert editing their own assessment invalidates the computed', () => {
		const timestamps = computed(() => manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getTs()));

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 1000 }));
		expect(timestamps.value).toEqual([1000]);

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 3000 }));

		expect(timestamps.value).toEqual([3000]);
	});

	test('an unverify invalidates the computed', () => {
		const senders = computed(() => manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getSender()));

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 1000 }));
		ingest(manager, verificationEvent({ sender: OTHER_EXPERT, relType: RelationType.ExpertVerify, ts: 1500 }));
		expect(senders.value).toEqual([EXPERT, OTHER_EXPERT]);

		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertUnverify, ts: 2000 }));

		expect(senders.value).toEqual([OTHER_EXPERT]);
	});

	test('an unverify only clears the sender’s own verification', () => {
		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 1000 }));

		// OTHER_EXPERT never verified, so their unverify must leave EXPERT's verification alone.
		ingest(manager, verificationEvent({ sender: OTHER_EXPERT, relType: RelationType.ExpertUnverify, ts: 2000 }));

		expect(manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getSender())).toEqual([EXPERT]);
	});

	test('an out-of-order older event does not supersede a newer one', () => {
		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 3000 }));

		// Both of these predate the stored verification and must be ignored.
		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertUnverify, ts: 1000 }));
		ingest(manager, verificationEvent({ sender: EXPERT, relType: RelationType.ExpertVerify, ts: 2000 }));

		expect(manager.getVerifications(TARGET_EVENT_ID).map((e) => e.getTs())).toEqual([3000]);
	});
});
