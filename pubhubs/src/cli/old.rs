use actix_web::{App, HttpServer};

use std::net::ToSocketAddrs as _;

use actix_web::web::{self, Data};

use anyhow::{Context, Result};
use env_logger::Env;

use log::{error, info, warn};

use crate::context::Main;

#[tokio::main]
pub async fn main() -> Result<()> {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    info!("Starting PubHubs!");

    let context = crate::context::Main::create(
        crate::config::File::from_env().context("failed to load configuration file")?,
    )
    .await
    .context("failed to initialize")?;

    let context = Data::from(context);

    let (ref hosts, port) = context.bind_to;

    let connection_check_nonce = context.connection_check_nonce.clone();
    let urls = context.url.clone();

    let mut addrs: Vec<std::net::SocketAddr> = Default::default();

    for host in hosts {
        for addr in (host.as_str(), port)
            .to_socket_addrs()
            .with_context(|| format!("failed to resolve {host} : {port} to socket address"))?
        {
            addrs.push(addr);
        }
    }

    let server_fut = HttpServer::new(move || {
        let context = context.clone();
        App::new().configure(move |cfg| create_app(cfg, context))
    })
    .bind(&*addrs)?
    .run();

    futures::try_join!(
        // run server
        async move { server_fut.await.context("failed to run server") },
        // and also check that the server is reachable via the url(s) specified in the config
        check_connections(urls, connection_check_nonce),
    )?;
    Ok(())
}

async fn check_connections(urls: crate::context::Urls, nonce: String) -> Result<()> {
    // Remove repetitions from [urls.for_browser, urls.for_yivi_app];
    // we do not check urls.for_hub, because this might be something like http://host.docker.internal
    let urlset: std::collections::HashSet<&url::Url> = [&urls.for_browser, &urls.for_yivi_app]
        .into_iter()
        .collect();
    // Put into a Vec of length 2, filling empty spots with None.
    let mut urls: Vec<Option<&url::Url>> = urlset.into_iter().map(Into::into).collect();
    urls.resize_with(2, Default::default);

    futures::try_join!(
        check_connection_abortable(urls[0], &nonce),
        check_connection_abortable(urls[1], &nonce),
    )?;
    Ok(())
}
/// Checks `url` returns `nonce`, provided url is not None.  Retries a few times upon failure.  Aborts on ctrl+c.
async fn check_connection_abortable(url: Option<&url::Url>, nonce: &str) -> Result<()> {
    if url.is_none() {
        return Ok(());
    }

    let url = url.unwrap().as_str().to_owned() + "_connection_check";

    let (abort_handle, abort_registration) = futures::future::AbortHandle::new_pair();

    futures::try_join!(
        async {
            futures::future::Abortable::new(check_connection(&url, nonce), abort_registration)
                .await
                .unwrap_or_else(|_| {
                    log::warn!("aborted connection check of {url}");
                    Ok(())
                })
        },
        async {
            tokio::signal::ctrl_c()
                .await
                .context("waiting for ctrl+c")?;
            abort_handle.abort();
            Ok(())
        }
    )
    .map(|_| ())
}
async fn check_connection(url: &str, nonce: &str) -> Result<()> {
    // awc works only in such single-threaded context
    tokio::task::LocalSet::new()
        .run_until(async move {
            info!("checking that you are reachable via {url} ...");
            for n in 0..10 {
                match check_connection_once(url, nonce).await {
                    Ok(_) => return Ok(()),
                    Err(e) => warn!("try nr. {n} to connect to {url} failed:  {e}"),
                };

                tokio::time::sleep(tokio::time::Duration::from_millis(2_u64.pow(n) * 100)).await;
            }

            #[cfg(debug_assertions)]
            error!("When running PubHubs as a developer, we often need to configure some urls to use the system, \
            we check reachability for two of them: 'urls.for_browser' and 'urls.for_yivi_app'. The browser url is what you can use on your local system to access the \
            platform via the browser. The yivi app is the url your phone needs to connect via the yivi app with the PubHubs central platform. By default change these settings \
            in 'default.yaml'. \
            In a real situation these will all be the same url, and can be configured under a single 'url' key,\
             but as a developer it's much harder to configure that way.");

            Err(anyhow::anyhow!("Could not connect to self via {}. This check is to see if users can reach PubHubs, since they need to be able to reach the server on the provided url. \
            Configure it in the file specified in 'PUBHUBS_CONFIG'.", url))

        })
        .await
}

async fn check_connection_once(url: &str, nonce: &str) -> Result<()> {
    let client = awc::Client::default();
    let mut resp = client
        .get(url)
        // awc cannot deal with the deflate content-encoding produced by the iLab proxy - not sure who's at
        // fault, but we circumvent this problem by setting Accept-Encoding to "identity".
        .insert_header((
            actix_web::http::header::ACCEPT_ENCODING,
            awc::http::header::ContentEncoding::Identity,
        ))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string() /* e is not Send */))?;

    let status = resp.status();
    anyhow::ensure!(status.is_success(), "{} returned status {}", url, status);

    let bytes = resp.body().await?;
    let result = String::from_utf8(bytes.to_vec())?;

    anyhow::ensure!(
        result == nonce,
        "{} did not return {}; we probably connected to another pubhubs instance, or to something else entirely",
        url,
        nonce
    );

    info!(" ✓ got correct response from {url}");
    Ok(())
}

fn config_actix_files(
    files: actix_files::Files,
    conf: &crate::config::StaticFiles,
) -> actix_files::Files {
    let mut files = files
        .use_etag(!conf.dont_use_etag)
        .use_last_modified(conf.use_last_modified)
        .prefer_utf8(!conf.dont_prefer_utf8);

    if conf.disable_content_disposition {
        files = files.disable_content_disposition();
    }

    files
}

// cfg: &mut web::ServiceConfig
fn create_app(cfg: &mut web::ServiceConfig, context: Data<Main>) {
    let static_files_conf = context.static_files_conf.clone();

    cfg.app_data(context)
        .service(web::redirect("/", "/client"))
        .service(config_actix_files(
            actix_files::Files::new("/client", "./static/assets/client").index_file("index.html"),
            &static_files_conf,
        ))
        // routes below map be prefixed with a language prefix "/nl", "/en", etc., which
        // will be stripped by the translation middleware
        .route(
            "/_connection_check",
            web::get().to(|context: Data<Main>| async move {
                actix_web::HttpResponse::Ok().body(context.connection_check_nonce.clone())
            }),
        );
}
