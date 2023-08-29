use actix_web::http::header::LOCATION;
use actix_web::web::Query;
use actix_web::{web, HttpRequest, HttpResponse};
use std::fs;
use std::path::Path;

use anyhow::{anyhow, Result};
use tokio::sync::{mpsc::Sender, oneshot};

use crate::context::Main;
use expry::{key_str, value, BytecodeVec, ValueVec};

use crate::cookie::policy_cookie::add_accepted_policy_session_cookie;
use crate::data::{
    DataCommands::{self, GetLatestPolicy},
    Policy,
};
use crate::hairy_ext::hairy_eval_html_translations;
use crate::translate::Translations;

pub(crate) async fn initialize_latest_policy<P: AsRef<Path>>(
    db: &Sender<DataCommands>,
    policy_location: P,
) -> Result<Policy> {
    let (tx, rx) = oneshot::channel();
    db.send(GetLatestPolicy { resp: tx })
        .await
        .expect("Expected to get the latest policy");

    let versions = fs::read_dir(&policy_location)?;

    let latest_location: Option<u32> = versions
        .filter_map(|x: std::io::Result<std::fs::DirEntry>| -> Option<u32> {
            let x = x.expect("to read policy directory");
            let p = x.path();
            if !p.is_dir() {
                return None;
            }
            p.file_name()?.to_str()?.parse().ok()
        })
        .max();

    let i: u32 = latest_location.ok_or_else(|| anyhow!("No latest policy can be found"))?;

    match rx.await.expect("Expected to use our channel")? {
        Some(policy) => {
            if i <= policy.version {
                Ok(policy)
            } else {
                create_latest_policy(db, &policy_location, &i).await
            }
        }
        None => create_latest_policy(db, &policy_location, &i).await,
    }
}

async fn create_latest_policy<P: AsRef<Path>>(
    db: &Sender<DataCommands>,
    policy_location: P,
    i: &u32,
) -> Result<Policy> {
    let policy_location = policy_location.as_ref();

    let policy = fs::read_to_string(policy_location.join(i.to_string()).join("policy.txt"))?;

    let highlights =
        fs::read_to_string(policy_location.join(i.to_string()).join("highlights.txt"))?
            .lines()
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect();
    Ok(Policy::new(policy, highlights, db, *i).await)
}

pub async fn policy(
    req: HttpRequest,
    context: web::Data<Main>,
    translations: Translations,
) -> HttpResponse {
    //TODO think about language of policy?

    let hair = &context.hair;
    let db_tx = &context.db_tx;

    let policy = get_latest_policy(db_tx).await.highlights;
    // let query = req.uri().query().unwrap_or("");
    //TODO check if we can type and use web::Query<> and deserialize to a struct....
    let query = req.query_string();

    let prefix = translations.prefix().to_string();
    let value =
        value!({"content": "policy", "highlights": policy, "query": query, "url_prefix": prefix})
            .to_vec(false);

    make_resp(hair, value, translations)
}

pub async fn full_policy(
    req: HttpRequest,
    context: web::Data<Main>,
    translations: Translations,
) -> HttpResponse {
    let hair = &context.hair;
    let db_tx = &context.db_tx;
    let _policy = get_latest_policy(db_tx).await.highlights;
    let query = req.query_string();
    let policy = get_latest_policy(db_tx).await.content;
    let prefix = translations.prefix().to_string();
    let value =
        value!({"content": "full_policy", "policy": policy, "query": query, "url_prefix": prefix})
            .to_vec(false);

    make_resp(hair, value, translations)
}

pub fn make_resp(hair: &BytecodeVec, value: ValueVec, translations: Translations) -> HttpResponse {
    //TODO return result, let it bubble up
    HttpResponse::Ok().body(
        hairy_eval_html_translations(hair.to_ref(), value.to_ref(), translations)
            .expect("Expected to render a template"),
    )

    // Response::new(Body::from(body))
}

async fn get_latest_policy(db_tx: &Sender<DataCommands>) -> Policy {
    let (tx, rx) = oneshot::channel();
    db_tx
        .send(GetLatestPolicy { resp: tx })
        .await
        .expect("Expected to use our channel to get the latest policy");
    match rx
        .await
        .expect("Expected to use our channel")
        .expect("Expected a response from the database")
    {
        Some(policy) => policy,
        None => Policy::empty(),
    }
}

pub async fn policy_accept(
    translations: Translations,
    query: Option<Query<String>>,
) -> HttpResponse {
    let mut resp = HttpResponse::Found();
    add_accepted_policy_session_cookie(&mut resp);
    resp.insert_header((
        LOCATION,
        format!(
            "{}/register?{}",
            translations.prefix(),
            query.unwrap_or_else(|| Query("".to_owned())).as_str()
        ),
    ));
    resp.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::make_in_memory_database_manager;
    use prometheus::{HistogramOpts, HistogramVec};
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use tokio::sync::mpsc;

    //endpoint tests found in main.rs
    #[tokio::test]
    async fn test_will_initialize_policy() {
        let db_tx = create_db();

        let dir = tempdir().unwrap();
        let v1 = dir.path().join("1");
        let v2 = dir.path().join("2");
        fs::create_dir(v1.clone()).unwrap();
        fs::create_dir(v2.clone()).unwrap();

        let mut policy = File::create(v2.join("policy.txt")).unwrap();
        let policy_text = r#"This is the policy
                                   - With some content"#;
        write!(policy, "{}", policy_text).unwrap();

        let highlights_text = ["highlight1", "highlight2"];
        let mut highlights = File::create(v2.join("highlights.txt")).unwrap();
        for highlight in highlights_text {
            writeln!(highlights, "{}", highlight).unwrap();
        }
        initialize_latest_policy(&db_tx, dir.path().to_str().unwrap())
            .await
            .unwrap();

        let policy = get_latest_policy(&db_tx).await;

        assert_eq!(policy.content, policy_text);

        assert_eq!(policy.highlights, highlights_text);
    }

    #[tokio::test]
    async fn test_will_override_older_policies() {
        let db_tx = create_db();

        let dir = tempdir().unwrap();
        let v1 = dir.path().join("1");

        fs::create_dir(v1.clone()).unwrap();

        let mut policy = File::create(v1.join("policy.txt")).unwrap();
        let policy_text = r#"This is the policy
                                   - With some content"#;
        write!(policy, "{}", policy_text).unwrap();

        let highlights_text = ["highlight1", "highlight2"];
        let mut highlights = File::create(v1.join("highlights.txt")).unwrap();
        for highlight in highlights_text {
            writeln!(highlights, "{}", highlight).unwrap();
        }
        initialize_latest_policy(&db_tx, dir.path().to_str().unwrap())
            .await
            .unwrap();

        let policy = get_latest_policy(&db_tx).await;

        assert_eq!(policy.content, policy_text);

        assert_eq!(policy.highlights, highlights_text);

        let v2 = dir.path().join("2");
        fs::create_dir(v2.clone()).unwrap();

        let mut policy = File::create(v2.join("policy.txt")).unwrap();
        let policy_text = r#"This is the updated policy
                                   - With some content"#;
        write!(policy, "{}", policy_text).unwrap();

        let highlights_text = ["highlight1.2", "highlight2.2"];
        let mut highlights = File::create(v2.join("highlights.txt")).unwrap();
        for highlight in highlights_text {
            writeln!(highlights, "{}", highlight).unwrap();
        }
        initialize_latest_policy(&db_tx, dir.path().to_str().unwrap())
            .await
            .unwrap();

        let policy = get_latest_policy(&db_tx).await;

        assert_eq!(policy.content, policy_text);

        assert_eq!(policy.highlights, highlights_text);
    }

    fn create_db() -> Sender<DataCommands> {
        let (db_tx, db_rx) = mpsc::channel(1_000);
        let database_req_histogram = HistogramVec::new(
            HistogramOpts::new(
                "database_request_duration_seconds",
                "The database request latencies in seconds per handler.",
            )
            .buckets(
                ([
                    0.0001f64, 0.0005f64, 0.001f64, 0.0025f64, 0.005f64, 0.01f64, 0.025f64,
                    0.05f64, 0.1f64, 0.25f64, 0.5f64,
                ])
                .to_vec(),
            ),
            &["command"],
        )
        .unwrap();

        make_in_memory_database_manager(db_rx, database_req_histogram);
        db_tx
    }
}
