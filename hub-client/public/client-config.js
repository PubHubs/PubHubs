// Normally overwritten per-container at startup by hub-client/start.sh. The native app instead bundles
// one static build shared by every hub, so global-client passes HUB_URL/PARENT_URL as query params on the
// iframe src (see global-client/src/pages/Hub.vue). Falls back to the dev defaults otherwise.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _env = (function () {
    var params = new URLSearchParams(window.location.search);
    var hubUrl = params.get('HUB_URL');
    var parentUrl = params.get('PARENT_URL');
    if (hubUrl && parentUrl) {
        return { "HUB_URL": hubUrl, "PARENT_URL": parentUrl, "TIMESTAMP": String(Date.now()) };
    }
    return {
        "HUB_URL": "http://localhost:8008",
        "PARENT_URL": "http://localhost:8080",
        "TIMESTAMP": "1698741086"
    };
})();
