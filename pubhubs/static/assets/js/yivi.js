// starts an Yivi session to login
function yiviLogin(url_prefix, register, oidc_handle) {
    let endpoint = register ? "/yivi-endpoint/register" : "/yivi-endpoint/start";
    let yivi = {};
    let evtSource = null;

    fetch(endpoint)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not OK');
            }
            return response.json()})
        .then(data => {
            let json = JSON.stringify(data.sessionPtr);
            let universalLink = `https://irma.app/-/session#${encodeURIComponent(json)}`;

            // Universal links are not stable in Android webviews and custom tabs, so always use intent links.
            let intent = `Intent;package=org.irmacard.cardemu;scheme=irma;l.timestamp=${Date.now()}`;
            let fallback = `S.browser_fallback_url=${encodeURIComponent(universalLink)}`;
            let mobileLink =  `intent://qr/json/${encodeURIComponent(json)}#${intent};${fallback};end`;

            let yivi_token = data.token;
	
            let redirectOnFocus = function() {
                window.addEventListener("focus", function(event) {
                    if (yivi.st != null) {
                        finish_and_redirect(yivi_token);
                    }
                });
                return true;
            }

            let ua = userAgent()
            let openInApp = document.createElement("a");
            openInApp.href = ua == "Android" ? mobileLink : universalLink;
            openInApp.innerHTML = '<button>Open in App</button>';
            openInApp.addEventListener('click', redirectOnFocus);

            let st = document.getElementById('yivi-status')
            st.innerHTML = '';
            if (ua == "Android" || ua == "iOS") {
                st.appendChild(openInApp);

                let scanQR = document.createElement("button");
                scanQR.innerHTML = '<button>Scan QR</button>';
                scanQR.addEventListener('click', function() {
                    st.innerHTML = '<div style="max-width: fit-content">' + data.svg + '</div>';
                });
                st.appendChild(scanQR);
            } else {
                st.innerHTML = '<div style="max-width: fit-content">' + data.svg + '</div>';
            }

            let modal = document.getElementById('yivi-modal');
            modal.hidden = false;

            let eventsURL =	data.sessionPtr.u + "/statusevents";
            yivi.st = st;
            yivi.eventsURL = eventsURL;
            yiviConnect(st, eventsURL, yivi_token, true);
        }).catch(e => {
        console.error('There has been a problem with your fetch operation:', e);
        yiviError();
    });

    function yiviConnect(st, eventsURL, yivi_token, reconnectOnFocus) {
        if (evtSource != null)
            evtSource.close();
        evtSource = new EventSource(eventsURL);

        evtSource.onerror = yiviError;
        evtSource.onmessage = function(event) {
            if (event.data == '"CONNECTED"') {
                st.innerHTML = '<p>Connected, please disclose your attributes in the app;</p>';
                return;
            }
            if (event.data == '"DONE"') {
                // expect the event source to be closed
                evtSource.onerror = null;

		finish_and_redirect(yivi_token);
                return;
            }
            if (event.data == '"CANCELLED"') {
                yivi = {};
            }
            console.log("cancelled: " + event.data);
            yiviError();
        }

        window.addEventListener('pagehide', () => {
          // page might be put in the back/forward cache,
          // so close and null the event source,
          // so we know we can ignore the error that it will throuw
          // upon reloading from the cache
          console.log("closing event source..");
          evtSource.close(); 
          evtSource = null;
        });
    }

    function yiviError(e) {
        if (evtSource === null) {
            // ignore error thrown by the event source in safari when 
            // its reloaded from the back/forward cache;
            // yiviLogin is reinvoked anyways, via the 'pageshow' event
            return;
        }
        console.error("Yivi error:", e);
        let st = document.getElementById('yivi-status');
        st.innerHTML = '<button onclick="window.yiviLoginWithDetailsProvided()">A problem occurred click to retry</button>';
        evtSource.close();
        evtSource = null;
    };
    window.yiviError = yiviError; // so we can simulate an error via the javascript console

    function finish_and_redirect(yivi_token) {
	// obtain cookie and redirect user-agent to appropriate location
	let form = document.createElement("form");
	form.setAttribute("method", "POST");
	form.setAttribute("action", "/yivi-endpoint/finish-and-redirect");

	
	let yivi_token_inp = document.createElement("input");
	yivi_token_inp.setAttribute("type", "hidden");
	yivi_token_inp.setAttribute("name", "yivi_token");
	yivi_token_inp.setAttribute("value", yivi_token);
	form.appendChild(yivi_token_inp);

	if (oidc_handle) {
		let oidc_handle_inp = document.createElement("input");
		oidc_handle_inp.setAttribute("type", "hidden");
		oidc_handle_inp.setAttribute("name", "oidc_auth_request_handle");
		oidc_handle_inp.setAttribute("value", oidc_handle);
		form.appendChild(oidc_handle_inp);
	}
	
	// required for some reason
	document.body.appendChild(form);

	form.submit();
    }

    function userAgent() {
        if ( typeof window === 'undefined' )
            return 'nodejs';

        // IE11 doesn't have window.navigator, test differently
        // https://stackoverflow.com/questions/21825157/internet-explorer-11-detection
        if (!!window.MSInputMethodContext && !!document.documentMode)
            return 'Desktop';

        if (/Android/i.test(window.navigator.userAgent)) {
            return 'Android';
        }

        // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)
            return 'iOS';

        // https://stackoverflow.com/questions/57776001/how-to-detect-ipad-pro-as-ipad-using-javascript
        if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
            return 'iOS';

        // Neither Android nor iOS, assuming desktop
        return 'Desktop';
    }
}
