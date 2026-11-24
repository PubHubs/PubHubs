/**
 * Three-way merge of the global settings, for when the copy at PHC changed (on another device) since
 * this device last loaded it. `base` is what this device loaded, `local` what it wants to store now,
 * `remote` what PHC has now. See docs/app/offline.md.
 *
 * - Theme, time format, language, last visited hub: a local change wins, otherwise the remote value.
 * - Pinned hubs: a hub added or removed on either side is added or removed. Local order is kept, with
 *   hubs added remotely appended in their remote order. Per hub, a locally changed token wins,
 *   otherwise the remote one; the remote hub name wins, since PHC keeps it up to date.
 */
import { type GlobalSettings, type PinnedHub } from '@global-client/stores/global';

function mergeHub(base: PinnedHub | undefined, local: PinnedHub, remote: PinnedHub | undefined): PinnedHub {
	if (!remote) return { ...local };
	const localTokenChanged = local.accessToken !== base?.accessToken || local.userId !== base?.userId;
	const tokenSource = localTokenChanged ? local : remote;
	return {
		hubId: local.hubId,
		hubName: remote.hubName || local.hubName,
		accessToken: tokenSource.accessToken,
		userId: tokenSource.userId,
	};
}

function mergeGlobalSettings(base: GlobalSettings | null, local: GlobalSettings, remote: GlobalSettings): GlobalSettings {
	const pick = <K extends 'theme' | 'timeformat' | 'language' | 'lastHubId'>(field: K): GlobalSettings[K] =>
		base !== null && local[field] === base[field] ? remote[field] : local[field];

	const byId = (hubs: PinnedHub[] | undefined) => new Map((hubs ?? []).map((hub) => [hub.hubId, hub]));
	const baseHubs = byId(base?.hubs);
	const localHubs = byId(local.hubs);
	const remoteHubs = byId(remote.hubs);

	const removedLocally = (id: string) => baseHubs.has(id) && !localHubs.has(id);
	const removedRemotely = (id: string) => baseHubs.has(id) && !remoteHubs.has(id);

	const hubs: PinnedHub[] = [];
	for (const hub of local.hubs ?? []) {
		if (removedRemotely(hub.hubId)) continue;
		hubs.push(mergeHub(baseHubs.get(hub.hubId), hub, remoteHubs.get(hub.hubId)));
	}
	for (const hub of remote.hubs ?? []) {
		if (localHubs.has(hub.hubId) || removedLocally(hub.hubId)) continue;
		hubs.push({ ...hub });
	}

	return { theme: pick('theme'), timeformat: pick('timeformat'), language: pick('language'), lastHubId: pick('lastHubId'), hubs };
}

export { mergeGlobalSettings };
