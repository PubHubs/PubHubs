// Appended as `cb` query param to every hub-client iframe URL. Defensive:
// even if a hub hoster's reverse proxy strips or overrides Cache-Control on
// index.html, varying the URL forces the browser to refetch and pick up the
// current asset hashes after a deploy. One value per global-client page load,
// so refreshing the global client will refresh the hub client as well.
export const cacheBust = String(Date.now());
