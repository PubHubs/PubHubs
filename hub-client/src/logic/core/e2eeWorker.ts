import E2EEWORKER from 'livekit-client/e2ee-worker?worker';

/** LiveKit's frame encryption runs in this worker. */
export function createE2EEWorker(): Worker {
	return new E2EEWORKER();
}
