/**
 * The hub's hubId, as embedded in the iframe URL query by the global client
 * (`?hubId=...`). Read once at module load.
 *
 * Used by iframe-mode code that needs to identify itself to the global client
 * (LocalStore protocol, AggregateUnreadState forwarding, etc.). Returns null
 * in solo mode or when the global client didn't embed it — callers should
 * handle that by degrading to in-memory / no-op behavior.
 */
export const hubId: string | null = (() => {
	try {
		return new URLSearchParams(window.location.search).get('hubId');
	} catch {
		return null;
	}
})();
