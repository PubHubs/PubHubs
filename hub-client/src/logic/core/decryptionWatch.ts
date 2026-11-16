// Packages
import { type Room as LivekitRoom, RemoteVideoTrack } from 'livekit-client';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import useVideoCall from '@hub-client/stores/videoCall';

const logger = createLogger('decryptionWatch');

// How often we compare a participant's video receive counters.
const sampleIntervalMs = 1000;
// How long frames may keep failing before we call it a failure rather than a key still on its way.
const failAfterMs = 4000;

type Counters = { received: number; decoded: number };
type Watch = { startedAt: number; previous: Counters | null; timer: number | undefined; stopped: boolean };

/**
 * Watches remote participants whose media failed to decrypt, and tells the store what their tile should show.
 *
 * A decryption error alone says little: right after joining, frames often arrive a moment before their key.
 * So we compare the video receive counters. E2EE sits between receiving and decoding:
 * - frames arriving but none decoded: decryption fails;
 * - frames decoded: it works (again);
 * - nothing arriving (camera off, tile paused by adaptive stream): we cannot tell, so we stop judging.
 */
export function createDecryptionWatch(livekitRoom: LivekitRoom) {
	const videoCall = useVideoCall();
	const watches = new Map<string, Watch>();

	/** Summed over camera and screen share: both use the participant's same key. Null when the participant is gone. */
	const readCounters = async (identity: string): Promise<Counters | null> => {
		const participant = livekitRoom.remoteParticipants.get(identity);
		if (!participant) return null;

		const tracks = [...participant.videoTrackPublications.values()]
			.map((publication) => publication.videoTrack)
			.filter((track): track is RemoteVideoTrack => track instanceof RemoteVideoTrack);
		const stats = await Promise.all(tracks.map((track) => track.getReceiverStats()));

		return stats.reduce<Counters>((sum, s) => (s ? { received: sum.received + s.framesReceived, decoded: sum.decoded + s.framesDecoded } : sum), {
			received: 0,
			decoded: 0,
		});
	};

	const sample = async (identity: string, watch: Watch) => {
		let current: Counters | null = null;
		try {
			current = await readCounters(identity);
		} catch (error) {
			logger.warn('Could not read receive statistics', { identity, error });
		}
		if (watch.stopped) return;
		if (!current) return forget(identity);

		const previous = watch.previous;
		watch.previous = current;

		// No baseline yet, or the counters restarted because a track was resubscribed: compare from here on.
		if (previous && current.received >= previous.received) {
			if (current.decoded > previous.decoded) return forget(identity); // decrypts (again)
			if (current.received === previous.received) return forget(identity); // nothing arrives: cannot tell
			if (Date.now() - watch.startedAt >= failAfterMs) videoCall.setParticipantDecryptionState(identity, 'failed');
		}

		watch.timer = window.setTimeout(() => void sample(identity, watch), sampleIntervalMs);
	};

	/** Call on every decryption error of a remote participant; repeated calls while watching are ignored. */
	const onError = (identity: string) => {
		if (watches.has(identity)) return;
		const watch: Watch = { startedAt: Date.now(), previous: null, timer: undefined, stopped: false };
		watches.set(identity, watch);
		videoCall.setParticipantDecryptionState(identity, 'pending');
		void sample(identity, watch);
	};

	const forget = (identity: string) => {
		const watch = watches.get(identity);
		if (!watch) return;
		watch.stopped = true;
		window.clearTimeout(watch.timer);
		watches.delete(identity);
		videoCall.setParticipantDecryptionState(identity, null);
	};

	const stop = () => [...watches.keys()].forEach(forget);

	return { onError, forget, stop };
}
