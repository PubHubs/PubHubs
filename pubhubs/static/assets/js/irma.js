function irmaLogin(endpoint,hub, state,result_url ) {
    let irma = {};
    let evtSource = null;
    fetch(endpoint)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not OK');
            }
            return response.json()})
        .then(data=> {
            let json = JSON.stringify(data.sessionPtr);
            let universalLink = `https://irma.app/-/session#${encodeURIComponent(json)}`;

            // Universal links are not stable in Android webviews and custom tabs, so always use intent links.
            let intent = `Intent;package=org.irmacard.cardemu;scheme=irma;l.timestamp=${Date.now()}`;
            let fallback = `S.browser_fallback_url=${encodeURIComponent(universalLink)}`;
            let mobileLink =  `intent://qr/json/${encodeURIComponent(json)}#${intent};${fallback};end`;

            let after = !hub ? `/irma-endpoint/${data.token}/result` : `/irma-endpoint/${data.token}/result?hub_id=${hub}`;

            let redirectOnFocus = function() {
                window.addEventListener("focus", function(event) {
                    if (irma.st != null) {
                        // redirect to retrieve hub pseudonym
                        redirect(after);
                    }
                });
                return true;
            }

            let ua = userAgent()
            let openInApp = document.createElement("a");
            openInApp.href = ua == "Android" ? mobileLink : universalLink;
            openInApp.innerHTML = '<button>Open in App</button>';
            openInApp.addEventListener('click', redirectOnFocus);

            let st = document.getElementById('irma-status')
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

            let modal = document.getElementById('irma-modal');
            modal.hidden = false;

            let eventsURL =	data.sessionPtr.u + "/statusevents";
            irma.st = st;
            irma.eventsURL = eventsURL;
            irmaConnect(st, eventsURL, after, true);
        }).catch(e => {
        console.error('There has been a problem with your fetch operation:', e);
        irmaError()
    });

    function irmaConnect(st, eventsURL, after, reconnectOnFocus) {
        if (evtSource != null)
            evtSource.close();
        evtSource = new EventSource(eventsURL);

        evtSource.onerror = irmaError;
        evtSource.onmessage = function(event) {
            if (event.data == '"CONNECTED"') {
                st.innerHTML = '<p>Connected, please disclose your attributes in the app;</p>';
                return;
            }
            if (event.data == '"DONE"') {
                // expect the event source to be closed
                evtSource.onerror = null;

                redirect(after);
                return;
            }
            if (event.data == '"CANCELLED"') {
                irma = {};
            }
            console.log("cancelled: " + event.data);
            irmaError();
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

    function irmaError(e) {
        if (evtSource === null) {
            // ignore error thrown by the event source in safari when 
            // its reloaded from the back/forward cache;
            // irmaLogin is reinvoked anyways, via the 'pageshow' event
            return;
        }
        console.error("irma error:", e);
        let st = document.getElementById('irma-status');
        st.innerHTML = '<button onclick="window.irmaLoginWithDetailsProvided()">A problem occurred click to retry</button>';
        evtSource.close();
        evtSource = null;
    };
    window.irmaError = irmaError; // so we can simulate an error via the javascript console

    function redirect(url) {
        fetch(new Request(url))
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not OK');
                }
                return response.json();
            })
            .then( result => {
                if (hub) {
                const request = new Request(result_url, {method: 'POST', body: `{"pmp": "${ result.pseudonym }", "state": "${state}"}`})
                request.headers.set("Content-Type", "application/json");
                const response = fetch(request);
                response.then(r => {
                    if (!r.ok) {
                        throw new Error('Network response was not OK');
                    }
                    return r.text();
                })
                    .then(text => {
                        window.location.href = text;
                    })
                }  else {
                        window.location.href = `/account/${result.account_id}`;
                }
            }
            ).catch(e => {
            console.error('There has been a problem with your fetch operation:', e);
            irmaError()
        });

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
