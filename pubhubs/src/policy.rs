use crate::cookie::add_accepted_policy_session_cookie;
use crate::data::Policy;
use crate::DataCommands::GetLatestPolicy;
use crate::{DataCommands, HeaderValue, TranslateFuncs};
use expry::key_str;
use expry::{value, BytecodeVec, ValueVec};
use hairy::hairy_eval_html_custom;
use hyper::header::LOCATION;
use hyper::{Body, Request, Response, StatusCode};

use std::ffi::OsString;
use std::fs;
use std::path::Path;
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;

use anyhow::{anyhow, Result};

pub(crate) async fn initialize_latest_policy<P: AsRef<Path>>(
    db: &Sender<DataCommands>,
    policy_location: P,
) -> Result<Policy> {
    let (tx, rx) = oneshot::channel();
    db.send(GetLatestPolicy { resp: tx })
        .await
        .expect("Expected to get the latest policy");

    let versions = fs::read_dir(&policy_location)?;

    let latest_location = versions
        .map(|x| match x {
            Ok(x) => {
                if x.path().is_dir() {
                    x.path()
                        .file_name()
                        .unwrap_or(&OsString::from("-1"))
                        .to_str()
                        .unwrap_or("-1")
                        .parse()
                        .unwrap_or(-1)
                } else {
                    -1
                }
            }
            _ => -1,
        })
        .filter(|x| *x > 0)
        .max();

    let i: i32 = latest_location.ok_or_else(|| anyhow!("No latest policy can be found"))?;

    match rx.await.expect("Expected to use our channel")? {
        Some(policy) => {
            if i <= policy.version as i32 {
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
    i: &i32,
) -> Result<Policy> {
    let policy_location = policy_location.as_ref();

    let policy = fs::read_to_string(policy_location.join(&i.to_string()).join("policy.txt"))?;

    let highlights =
        fs::read_to_string(policy_location.join(&i.to_string()).join("highlights.txt"))?
            .lines()
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect();
    Ok(Policy::new(policy, highlights, db, *i).await)
}

pub async fn policy(
    req: &Request<Body>,
    hair: &BytecodeVec,
    db_tx: &Sender<DataCommands>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    //TODO think about language of policy?
    let policy = get_latest_policy(db_tx).await.highlights;
    let query = req.uri().query().unwrap_or("");
    let prefix = translations.get_prefix();
    let value =
        value!({"content": "policy", "highlights": policy, "query": query, "url_prefix": prefix})
            .to_vec(false);

    make_resp(hair, value, translations)
}

pub async fn full_policy(
    req: &Request<Body>,
    hair: &BytecodeVec,
    db_tx: &Sender<DataCommands>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let policy = get_latest_policy(db_tx).await.content;
    let query = req.uri().query().unwrap_or("");
    let prefix = translations.get_prefix();
    let value =
        value!({"content": "full_policy", "policy": policy, "query": query, "url_prefix": prefix})
            .to_vec(false);

    make_resp(hair, value, translations)
}

pub fn make_resp(
    hair: &BytecodeVec,
    value: ValueVec,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let body = hairy_eval_html_custom(hair.to_ref(), value.to_ref(), translations)
        .expect("Expected to render a template");

    Response::new(Body::from(body))
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

pub async fn policy_accept(req: &Request<Body>, translations: &TranslateFuncs) -> Response<Body> {
    let mut resp = Response::new(Body::empty());
    resp = add_accepted_policy_session_cookie(resp);
    *resp.status_mut() = StatusCode::FOUND;
    resp.headers_mut().insert(
        LOCATION,
        HeaderValue::from_str(
            format!(
                "{}/register?{}",
                translations.get_prefix(),
                req.uri().query().unwrap_or("")
            )
            .as_str(),
        )
        .unwrap(),
    );
    resp
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::make_in_memory_database_manager;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use tokio::sync::mpsc;

    //endpoint tests found in main.rs
    #[tokio::test]
    async fn test_will_initialize_policy() {
        let (db_tx, db_rx) = mpsc::channel(1_000);
        make_in_memory_database_manager(db_rx);

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
        let (db_tx, db_rx) = mpsc::channel(1_000);
        make_in_memory_database_manager(db_rx);

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
}
