# iOS hub isolation: what to test

## Setup

- Web Inspector on (iPhone: **Settings → Apps → Safari → Advanced**; Mac: **Safari → Settings → Advanced → Show features for web developers**).
- Two test hubs and PHC running, `npm run cap:run:ios`, log in, open both hubs once, leave hub 0 open.
- **Safari → Develop → [iPhone] → PubHubs**. Pick the context next to the console prompt and check it with `location.origin`:
    - shell: `capacitor://pubhubs-app.invalid`
    - hub 0: `capacitor://<label>.hubs.pubhubs-app.invalid`

## 1. IndexedDB persists on the hub origins

**Why:** the first run found no databases in the hub frames. Without IndexedDB the hub client silently runs from memory, and nothing survives a restart (Matrix store, offline data).

In **hub 0**:

```js
(async () => {
	const open = indexedDB.open('isolation-probe', 1);
	open.onupgradeneeded = () => open.result.createObjectStore('probe');
	const db = await new Promise((ok, fail) => ((open.onsuccess = () => ok(open.result)), (open.onerror = () => fail(open.error))));
	const tx = db.transaction('probe', 'readwrite');
	tx.objectStore('probe').put(new Date().toISOString(), 'marker');
	await new Promise((ok) => (tx.oncomplete = ok));
	db.close();
	console.log('written; databases:', (await indexedDB.databases()).map((d) => d.name));
})();
```

Force-quit the app, relaunch, open hub 0, and in **hub 0**:

```js
(async () => {
	const open = indexedDB.open('isolation-probe', 1);
	const db = await new Promise((ok, fail) => ((open.onsuccess = () => ok(open.result)), (open.onerror = () => fail(open.error))));
	let marker = '(none)';
	if (db.objectStoreNames.contains('probe')) {
		const get = db.transaction('probe').objectStore('probe').get('marker');
		marker = await new Promise((ok) => (get.onsuccess = () => ok(get.result)));
	}
	db.close();
	console.log('marker:', marker, 'databases:', (await indexedDB.databases()).map((d) => d.name));
})();
```

**Pass:** both runs list `matrix-js-sdk:pubhubs-db-…`, and the marker shows the time from before the restart. Clean up with `indexedDB.deleteDatabase('isolation-probe')`.

## 2. The shell can't be navigated to a hub

**Why:** iOS has no native block for this, unlike Android. Otherwise a hub page could replace the app.

In the **shell**:

```js
const hubFrame = document.querySelector('iframe[src*=".hubs."]');
hubFrame ? (location.href = hubFrame.src) : 'no hub frame: wrong context';
```

**Pass:** the app stays on the shell. If the whole app turns into the hub client, iOS needs a native block.

## 3. A hub frame refuses a wrong server

**Why:** a hub frame gets its server address from its own URL, so it must refuse to log in anywhere but the server the app expects.

Switch to hub 1 and back first, so hub 0 is on its own origin. Then in **hub 0**:

```js
const q = new URLSearchParams(location.search);
q.set('HUB_URL', 'http://evil.example');
location.search = q.toString();
```

**Pass:** the console logs `Handshake refused: the parent expects a different hub server`, and the Network tab shows no request to `evil.example`. Switch hubs again to restore.

## Results

Date: ______ Device / iOS: ______ Commit: ______

| Test | Result | Notes |
| --- | --- | --- |
| 1. IndexedDB persists | | |
| 2. Shell navigation refused | | |
| 3. Wrong server refused | | |
