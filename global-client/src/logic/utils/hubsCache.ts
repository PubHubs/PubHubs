/**
 * The last known hub directory, so the app can show and open hubs while PHC can't be reached (see
 * docs/app/offline.md). Kept in plain localStorage: it is PHC's public hub list, and not tied to a user.
 */
import { Hub } from '@global-client/models/Hubs';

const STORAGE_KEY = 'ph:hubs-cache';

type CachedHub = Pick<Hub, 'hubId' | 'hubName' | 'url' | 'serverUrl' | 'description'>;

function loadHubsCache(): { [index: string]: Hub } {
	const hubs: { [index: string]: Hub } = {};
	try {
		const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CachedHub[];
		for (const item of cached) {
			hubs[item.hubId] = new Hub(item.hubId, item.hubName, item.url, item.serverUrl, item.description);
		}
	} catch {
		// Unreadable: start without a cache.
	}
	return hubs;
}

function saveHubsCache(hubs: { [index: string]: Hub }): void {
	const cached: CachedHub[] = Object.values(hubs).map(({ hubId, hubName, url, serverUrl, description }) => ({ hubId, hubName, url, serverUrl, description }));
	localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export { loadHubsCache, saveHubsCache };
