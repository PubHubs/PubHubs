use crate::pseudonyms::PepContext;
use anyhow::{anyhow, bail, ensure, Result};
use expry::key_str;
use expry::{value, DecodedValue};
use pbkdf2::password_hash::rand_core::OsRng;
use pbkdf2::password_hash::{PasswordHasher, SaltString};
use pbkdf2::Pbkdf2;
use rand::distributions::Alphanumeric;
use rand::Rng;
use rusqlite::Error::QueryReturnedNoRows;
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use std::path::Path;
use std::str::FromStr;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::oneshot;
use uuid::Uuid;

// Add new DDL statements at end of this vector. Do not modify previous statements. User version of the database
// schema will be determined based on the index in the array.
const MIGRATIONS: [&str; 5] = [
    "
        -- Commented out, for efficiency,
        --   because it's dropped later on anyhow 
        --
        -- CREATE TABLE hub (
        -- id INTEGER PRIMARY KEY,
        -- name TEXT NOT NULL,
        -- description TEXT NOT NULL,
        -- server_secret TEXT NOT NULL,
        -- decryption_context TEXT NOT NULL,
        -- redirection_uri TEXT NOT NULL,
        -- passphrase TEXT NOT NULL,
        -- active INTEGER NOT NULL
        -- );
        --
        -- CREATE UNIQUE INDEX idx_hub_name ON hub (name);

        CREATE TABLE user (
        id  INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        telephone TEXT NOT NULL,
        pseudonym TEXT NOT NULL,
        active INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX idx_user_email_telephone ON user (email, telephone);",
    "
        ALTER TABLE user ADD administrator INTEGER NOT NULL DEFAULT 0; 
        ", //0 is the value for a boolean false
    "
        CREATE TABLE policy (
            id  INTEGER PRIMARY KEY,
            content TEXT NOT NULL,
            version INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX idx_policy_version ON policy (version);

       CREATE TABLE policy_highlights (
            id  INTEGER PRIMARY KEY,
            content TEXT NOT NULL,
            policy INTEGER NOT NULL,
            CHECK(
                length(content) <= 100
            ),
            FOREIGN KEY(policy) REFERENCES policy(id)
       );
    ",
    // not migrating existing hubs (as it's not worth the effort)
    "
        -- DROP TABLE hub;
        --
        -- CREATE TABLE hub (
        -- id TEXT PRIMARY KEY,
        -- name TEXT NOT NULL,
        -- description TEXT NOT NULL,
        -- redirection_uri TEXT NOT NULL,
        -- passphrase TEXT NOT NULL,
        -- active INTEGER NOT NULL
        -- );
        --
        -- CREATE UNIQUE INDEX idx_hub_name ON hub (name);
    ",
    // forgot one field..
    "
        DROP TABLE IF EXISTS hub;

        CREATE TABLE hub (
        id TEXT PRIMARY KEY,
        decryption_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        redirection_uri TEXT NOT NULL,
        passphrase TEXT NOT NULL,
        active INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX idx_hub_name ON hub (name);
    ",
];

#[derive(Debug)]
pub enum DataCommands {
    AllHubs {
        resp: oneshot::Sender<Result<Vec<Hub>>>,
    },
    CreateHub {
        name: String,
        description: String,
        redirection_uri: String,
        passphrase: String,
        resp: oneshot::Sender<Result<Hubid>>,
    },
    GetHub {
        resp: oneshot::Sender<Result<Hub>>,
        handle: HubHandle,
    },
    GetHubid {
        resp: oneshot::Sender<Result<Option<Hubid>>>,
        name: String,
    },
    UpdateHub {
        resp: oneshot::Sender<Result<Hub>>,
        id: Hubid,
        name: String,
        description: String,
    },
    AllUsers {
        resp: oneshot::Sender<Result<Vec<User>>>,
    },
    CreateUser {
        resp: oneshot::Sender<Result<User>>,
        email: String,
        telephone: String,
        config: PepContext,
        is_admin: bool,
    },
    GetUser {
        resp: oneshot::Sender<Result<Option<User>>>,
        email: String,
        telephone: String,
    },
    GetUserById {
        resp: oneshot::Sender<Result<User>>,
        id: u32,
    },
    CreatePolicy {
        resp: oneshot::Sender<Result<Policy>>,
        content: String,
        highlights: Vec<String>,
        version: i32,
    },
    GetLatestPolicy {
        resp: oneshot::Sender<Result<Option<Policy>>>,
    },
    // #[cfg(test)] // does not work for the binary
    Terminate {},
}

pub fn make_database_manager<P: AsRef<Path>>(path: P, rx: Receiver<DataCommands>) {
    // can't pass reference to new thread
    let path = path.as_ref().to_path_buf();

    tokio::spawn(async move {
        let manager = get_manager(path).expect("A database connection");
        handle_command(rx, manager).await
    });
}

pub fn make_in_memory_database_manager(rx: Receiver<DataCommands>) {
    tokio::spawn(async move {
        let manager = get_connection_memory().expect("A connection to an in-memory database");
        handle_command(rx, manager).await
    });
}

async fn handle_command(mut rx: Receiver<DataCommands>, mut manager: Connection) {
    while let Some(cmd) = rx.recv().await {
        match cmd {
            DataCommands::AllHubs { resp } => {
                let hubs = get_all_hubs(&manager);
                resp.send(hubs).expect("To use our channel");
            }
            DataCommands::CreateHub {
                name,
                description,
                redirection_uri,
                passphrase,
                resp,
            } => {
                resp.send(create_hub(
                    &manager,
                    &name,
                    &description,
                    &redirection_uri,
                    &passphrase,
                ))
                .expect("To use our channel");
            }
            DataCommands::GetHub { resp, handle } => {
                resp.send(get_hub(&manager, handle))
                    .expect("To use our channel");
            }
            DataCommands::GetHubid { resp, name } => {
                resp.send(get_hubid(&manager, &name))
                    .expect("To use our channel");
            }
            DataCommands::UpdateHub {
                resp,
                id,
                name,
                description,
            } => {
                resp.send(update_hub_details(&manager, id, &name, &description))
                    .expect("To use our channel");
            }
            DataCommands::AllUsers { resp } => {
                let users = get_all_users(&manager);
                resp.send(users).expect("To use our channel");
            }
            DataCommands::CreateUser {
                resp,
                email,
                telephone,
                config,
                is_admin,
            } => {
                resp.send(create_user(&manager, &email, &telephone, &config, is_admin))
                    .expect("To use our channel");
            }
            DataCommands::GetUser {
                resp,
                email,
                telephone,
            } => {
                resp.send(get_user(&manager, &email, &telephone))
                    .expect("To use our channel");
            }
            DataCommands::GetUserById { resp, id } => resp
                .send(get_user_by_id(&manager, id))
                .expect("Trying to use the data channel"),
            DataCommands::CreatePolicy {
                resp,
                content,
                highlights,
                version,
            } => resp
                .send(create_new_policy(
                    &mut manager,
                    &content,
                    highlights,
                    version,
                ))
                .expect("Expected to use the data channel"),
            DataCommands::GetLatestPolicy { resp } => resp
                .send(get_latest_policy(&manager))
                .expect("Expected to use the data channel"),
            //#[cfg(test)]
            DataCommands::Terminate {} => break,
        }
    }
}

/// Fetch a pool to a database located at the given path. Will initialize the database with the correct schemas if not created yet.
pub fn get_manager<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let mut manager = Connection::open(path)?;
    init_database(&mut manager)?;
    Ok(manager)
}

pub fn get_connection_memory() -> Result<Connection> {
    let mut manager = Connection::open_in_memory()?;
    init_database(&mut manager)?;
    Ok(manager)
}

#[derive(Debug)]
pub struct Policy {
    pub id: u32,
    pub content: String,
    pub version: u32,
    pub highlights: Vec<String>,
}

pub fn create_new_policy(
    db: &mut Connection,
    content: &str,
    highlights: Vec<String>,
    version: i32,
) -> Result<Policy> {
    let tx = db.transaction()?;
    tx.execute(
        "INSERT INTO policy (version, content) VALUES (?1, ?2)",
        [version.to_string(), content.to_string()],
    )?;
    for highlight in highlights {
        tx.execute("INSERT INTO policy_highlights (policy, content) VALUES ((SELECT id FROM policy WHERE version = ?2), ?1)", [highlight, version.to_string()])?;
    }
    tx.commit()?;

    Ok(get_latest_policy(db)?
        .expect("Expected to have just inserted a policy so there to be a latest version"))
}

impl Policy {
    pub async fn new(
        content: String,
        highlights: Vec<String>,
        db: &Sender<DataCommands>,
        version: i32,
    ) -> Self {
        let (tx, rx) = oneshot::channel();
        db.send(DataCommands::CreatePolicy {
            resp: tx,
            content,
            highlights,
            version,
        })
        .await
        .expect("Expected to be able to create the latest policy");
        rx.await
            .expect("Expected to create a policy")
            .expect("Expected to make the latest policy")
    }

    pub fn empty() -> Self {
        Policy {
            id: 0,
            content: "".to_string(),
            version: 0,
            highlights: vec![],
        }
    }
}

pub fn get_latest_policy(db: &Connection) -> Result<Option<Policy>> {
    let result = match db.query_row(
        "SELECT id, content, version FROM policy
        WHERE version = (select MAX(version) from policy)",
        [],
        map_policy,
    ) {
        Ok(policy) => Ok(policy),
        Err(QueryReturnedNoRows) => return Ok(None),
        Err(err) => Err(err),
    };

    let mut result = result?;

    let mut stmt = db.prepare("SELECT content from policy_highlights WHERE policy = ?")?;
    let highlights = stmt.query_map([result.id], |row| row.get(0))?;

    let mut hl = Vec::new();
    for highlight in highlights {
        hl.push(highlight?);
    }

    result.highlights = hl;

    Ok(Some(result))
}

fn map_policy(row: &Row) -> Result<Policy, rusqlite::Error> {
    Ok(Policy {
        id: row.get(0)?,
        content: row.get(1)?,
        version: row.get(2)?,
        highlights: vec![],
    })
}

#[derive(PartialEq, Eq, Serialize, Clone)]
pub struct Hub {
    pub id: Hubid,
    // While id being used for the generation of local pseudonyms ought
    // to be immutable, a mutable decryption_id is used to generate
    // the hub's local decryption key (aka the 'Hub secret') so that it
    // can be changed when the Hub secret is compromised.
    pub decryption_id: Hubid,
    pub name: String,
    pub description: String,
    pub redirection_uri: String,
    pub passphrase: String,
    pub active: bool,
}

/// Represents a (decryption) id of a Hub,
/// a uuid which is formatted as lower-case hex with hyphens, e.g.:
///   936da01f-9abd-4d9d-80c7-02af85c822a8
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Hubid {
    data: [u8; Hubid::LENGTH],
}

impl Hubid {
    pub const LENGTH: usize = uuid::fmt::Hyphenated::LENGTH;

    // we don't want to implement Default for Hubid
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self::from_uuid(Uuid::new_v4())
    }

    pub fn as_str(&self) -> &str {
        unsafe {
            // We are sure that self.data contains valid UTF-8 data,
            // because self.data will always be the hyphenated
            // representation of some uuid.
            std::str::from_utf8_unchecked(&self.data)
        }
    }

    fn from_uuid(uuid: Uuid) -> Self {
        let mut data: [u8; Self::LENGTH] = [0; Self::LENGTH];
        uuid.hyphenated().encode_lower(&mut data);
        Hubid { data }
    }
}

impl std::fmt::Display for Hubid {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Debug for Hubid {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(self, f)
    }
}

impl FromStr for Hubid {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        Ok(Uuid::try_parse(s).map(Hubid::from_uuid)?)
    }
}

// We serialize a uuid as a lower case hyphened hex string.
// (Note: using derive(Serialize), we'd get a tuple instead.)
impl Serialize for Hubid {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Hubid {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct Visitor;

        return deserializer.deserialize_string(Visitor {});

        impl<'ve> serde::de::Visitor<'ve> for Visitor {
            type Value = Hubid;

            fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
                formatter.write_str("a uuid")
            }

            fn visit_str<E>(self, s: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Hubid::from_str(s).map_err(serde::de::Error::custom)
            }
        }
    }
}

impl rusqlite::types::FromSql for Hubid {
    fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        Hubid::from_str(value.as_str()?)
            .map_err(|e| rusqlite::types::FromSqlError::Other(Box::from(e)))
    }
}

impl rusqlite::types::ToSql for Hubid {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput> {
        Ok(rusqlite::types::ToSqlOutput::Owned(
            rusqlite::types::Value::Text(self.to_string()),
        ))
    }
}

/// Represents a handle to get a hub:  either its name or its identifier.
pub enum HubHandle {
    Id(Hubid),
    Name(String),
}

impl std::fmt::Display for HubHandle {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Debug for HubHandle {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(self, f)
    }
}

impl HubHandle {
    /// Returns the name of the column in the hub table associated
    /// to this handle's type.
    fn column_name(&self) -> &'static str {
        match self {
            HubHandle::Id(_) => "id",
            HubHandle::Name(_) => "name",
        }
    }

    // Warning:  changing this will break other code.
    pub fn as_str(&self) -> &str {
        match self {
            HubHandle::Id(id) => id.as_str(),
            HubHandle::Name(name) => name.as_str(),
        }
    }
}

impl Hub {
    /// DO NOT CHANGE lest you'll change all local decryption keys
    pub fn decryption_context(&self) -> String {
        format!("Hub decryption key #{}", self.decryption_id)
    }

    /// DO NOT CHANGE lest you'll change all local pseudonyms.
    pub fn pseudonymisation_context(&self) -> String {
        format!("Hub #{}", self.id)
    }
}

impl Debug for Hub {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Hub")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("active", &self.active)
            .finish()
    }
}

impl<'a> From<&'a Hub> for DecodedValue<'a> {
    fn from(v: &'a Hub) -> Self {
        value!({"id": v.id.data, "name": v.name, "description": v.description, "redirection_uri": v.redirection_uri})
    }
}

pub fn create_hub(
    db: &Connection,
    name: &str,
    description: &str,
    redirection_uri: &str,
    passphrase: &str,
) -> Result<Hubid> {
    let salt = SaltString::generate(&mut OsRng);
    let passphrase = Pbkdf2
        .hash_password(passphrase.as_ref(), &salt)
        .unwrap()
        .to_string();

    let hubid = Hubid::new();
    let decryption_id = Hubid::new();

    let rows_changed = db.execute(
        "INSERT INTO hub (name, description, redirection_uri, passphrase, active, id, decryption_id)
        values (?1, ?2, ?3, ?4, TRUE, ?5, ?6)",
        params![name, description, redirection_uri, passphrase, hubid, decryption_id],
    )?;

    ensure!(
        rows_changed == 1,
        "expected to change one row by inserting new hub"
    );

    Ok(hubid)
}

fn map_hub(row: &Row) -> rusqlite::Result<Hub> {
    Ok(Hub {
        id: row.get(0)?,
        decryption_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        redirection_uri: row.get(4)?,
        passphrase: row.get(5)?,
        active: row.get(6)?,
    })
}

/// Get a hub by id if it's active.
pub fn get_hub(db: &Connection, handle: HubHandle) -> Result<Hub> {
    let query = format!(
        "SELECT id, decryption_id, name, description, redirection_uri, passphrase, active FROM hub
        WHERE active = TRUE AND {} = ?1",
        handle.column_name()
    );
    let result = db.query_row(&query, [handle.as_str()], map_hub)?;
    Ok(result)
}

/// Get a hub's id by the hub's name
pub fn get_hubid(db: &Connection, name: &str) -> Result<Option<Hubid>> {
    match db.query_row(
        "SELECT id FROM hub
        WHERE active = TRUE AND hub.name = ?1",
        [name],
        |row| row.get(0),
    ) {
        Ok(id) => Ok(id),
        Err(QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(anyhow!(err)),
    }
}

/// List all hubs
pub fn get_all_hubs(db: &Connection) -> Result<Vec<Hub>> {
    let mut stmt = db.prepare(
        "SELECT id, decryption_id, name, description, redirection_uri, passphrase, active FROM hub WHERE active = TRUE",
    )?;
    let result: Result<Vec<Hub>, rusqlite::Error> = stmt.query_map([], map_hub)?.collect();
    Ok(result?)
}

//Will be used later
#[allow(dead_code)]
pub fn delete_hub(db: &Connection, id: Hubid) -> Result<usize> {
    let result = db.execute(
        "UPDATE hub
        SET active = FALSE
        WHERE active = TRUE AND id = ?1",
        [id.to_string()],
    )?;
    Ok(result)
}

pub fn update_hub_details(
    db: &Connection,
    id: Hubid,
    name: &str,
    description: &str,
) -> Result<Hub> {
    let rows_changed = db.execute(
        "UPDATE hub
        SET name = ?1, description = ?2
        WHERE active = TRUE AND id = ?3",
        params![name, description, id.to_string()],
    )?;

    ensure!(
        rows_changed == 1,
        "expected to change 1 database row on hub update"
    );

    // The UPDATE above and the SELECT in the get_hub below could be
    // merged into one query, but since hub updates are infrequent,
    // we refrain from this runtime optimisation to optimise code size.
    get_hub(db, HubHandle::Id(id))
}

#[derive(PartialEq, Eq, Serialize)]
pub struct User {
    pub id: i32,
    pub email: String,
    pub telephone: String,
    pub pseudonym: String,
    pub active: bool,
    pub administrator: bool,
}

impl Debug for User {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("User")
            .field("id", &self.id)
            .field("active", &self.active)
            .field("administrator", &self.administrator)
            .finish()
    }
}

impl<'a> From<&'a User> for DecodedValue<'a> {
    fn from(user: &'a User) -> Self {
        value!({"id": user.id as i64, "email": user.email, "telephone": user.telephone})
    }
}

pub fn create_user(
    db: &Connection,
    email: &str,
    telephone: &str,
    pep: &PepContext,
    is_admin: bool,
) -> Result<User> {
    let s: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect();
    let uuid = Uuid::new_v4().to_string();

    let pseudonym = pep.generate_pseudonym(&format!("{}{}", s, uuid))?;
    db.execute(
        "INSERT INTO user (email, telephone, pseudonym, active, administrator)
        values (?1, ?2, ?3, TRUE, ?4)",
        params![email, telephone, pseudonym, is_admin],
    )?;
    Ok(get_user(db, email, telephone)?.expect("user to exist after succesful insertion"))
}

pub fn get_user(db: &Connection, email: &str, telephone: &str) -> Result<Option<User>> {
    match db.query_row(
        "SELECT id, email, telephone, pseudonym, active, administrator FROM user
        WHERE active = TRUE AND email = ?1 AND telephone = ?2",
        [email, telephone],
        map_user,
    ) {
        Ok(user) => Ok(Some(user)),
        Err(QueryReturnedNoRows) => Ok(None),
        Err(err) => bail!(err),
    }
}

//Will be used later
#[allow(dead_code)]
pub fn get_user_by_id(db: &Connection, id: u32) -> Result<User> {
    let result = db.query_row(
        "SELECT id, email, telephone, pseudonym, active, administrator FROM user
        WHERE active = TRUE AND id = ?1",
        [id],
        map_user,
    )?;
    Ok(result)
}

pub fn get_all_users(db: &Connection) -> Result<Vec<User>> {
    let mut stmt =
        db.prepare("SELECT id, email, telephone, pseudonym, active, administrator FROM user WHERE active = TRUE")?;
    let result: Result<Vec<User>, rusqlite::Error> = stmt.query_map([], map_user)?.collect();
    Ok(result?)
}

//Will be used later
#[allow(dead_code)]
pub fn delete_user(db: &Connection, email: &str, telephone: &str) -> Result<usize> {
    let result = db.execute(
        "UPDATE user
        SET active = FALSE
        WHERE active = TRUE AND email = ?1 and telephone = ?2",
        [email, telephone],
    )?;
    Ok(result)
}

//Will be used later
#[allow(dead_code)]
pub fn update_user(db: &Connection, user: User) -> Result<usize> {
    let result = db.execute(
        "UPDATE user
        SET email = ?1, telephone = ?2, pseudonym = ?3
        WHERE active = TRUE AND id = ?4",
        [
            user.email,
            user.telephone,
            user.pseudonym,
            user.id.to_string(),
        ],
    )?;
    Ok(result)
}

fn map_user(row: &Row) -> Result<User, rusqlite::Error> {
    Ok(User {
        id: row.get(0)?,
        email: row.get(1)?,
        telephone: row.get(2)?,
        pseudonym: row.get(3)?,
        active: row.get(4)?,
        administrator: row.get(5)?,
    })
}

fn schema_version(db: &Connection) -> Result<usize, rusqlite::Error> {
    db.query_row_and_then("PRAGMA user_version", [], |row| row.get(0))
}

fn init_database(db: &mut Connection) -> Result<()> {
    for (previous_version, migration) in MIGRATIONS.iter().enumerate() {
        if previous_version == schema_version(db)? {
            migrate(db, migration, previous_version + 1)?
        }
    }

    Ok(())
}

fn migrate(db: &mut Connection, sql: &str, version: usize) -> Result<()> {
    let tx = db.transaction()?;
    tx.execute_batch(sql)?;
    // Yes it's a formatted string, this is because rusqlite
    // does not let us make a prepared statement with PRAGMA. Fortunately it's a usize parameter.
    tx.execute(format!("PRAGMA user_version = {version};").as_str(), [])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
#[allow(unused_variables)]
#[allow(unused_must_use)]
mod tests {
    use super::*;
    use std::fs::remove_file;
    use uuid::Uuid;

    struct AutoDeleteDb {
        location: String,
    }

    impl AutoDeleteDb {
        fn set_up(location: &str) -> Self {
            AutoDeleteDb {
                location: location.to_string(),
            }
        }
    }

    impl Drop for AutoDeleteDb {
        fn drop(&mut self) {
            remove_file(&self.location);
        }
    }

    fn set_up(name: &str) -> (Connection, AutoDeleteDb) {
        let uuid = Uuid::new_v4();
        let test_db = format!("{}{}.db", name, uuid);
        let will_be_dropped = AutoDeleteDb::set_up(test_db.as_str());
        (get_manager(test_db.as_str()).unwrap(), will_be_dropped)
    }

    #[test]
    fn can_create_hub_and_name_needs_to_be_unique() {
        let (pool, delete) = set_up("can_create_hub_and_name_needs_to_be_unique");
        let name1 = "hub1";
        let description1 = "description1";
        let name2 = "hub2";
        let description2 = "description2";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "password").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert!(hub.active);
        assert_eq!(hub.pseudonymisation_context(), format!("Hub #{}", hubid1)); // DO NOT CHANGE the pseudonymisation_context lest all local pseudonyms will change
        assert_eq!(
            hub.decryption_context(),
            format!("Hub decryption key #{}", hub.decryption_id)
        );
        assert_eq!(hub.name, name1);
        let not_unique = create_hub(&pool, name1, description1, "/callback", "password");
        compare_error("UNIQUE constraint failed: hub.name", not_unique);

        let hubid2 = create_hub(&pool, name2, description2, "/callback", "password").unwrap();
        let hub2_really = get_hub(&pool, HubHandle::Id(hubid2)).unwrap();
        assert_eq!(hub2_really.id, hubid2);
    }

    #[test]
    fn can_delete_hub() {
        let (pool, delete) = set_up("can_delete_hub");
        let name1 = "hub1";
        let description1 = "description1";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "password").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert!(hub.active);
        delete_hub(&pool, hubid1);
        let hub_result = get_hub(&pool, HubHandle::Id(hubid1));
        compare_error("Query returned no rows", hub_result);

        let hub = pool
            .query_row(
                "SELECT id, decryption_id, name, description, redirection_uri, passphrase, active FROM hub WHERE name = ?1",
                [name1],
                map_hub,
            )
            .unwrap();
        assert!(!hub.active)
    }

    #[test]
    fn can_update_hub_name() {
        let (pool, delete) = set_up("can_update_hub_name");
        let name1 = "hub1";
        let description1 = "description1";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "password").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert_eq!(hub.name, name1);
        let name2 = "name2";
        let description2 = "description2";
        update_hub_details(&pool, hubid1, name2, description2);
        let updated_hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert_eq!(updated_hub.name, name2);

        // Different hub
        let hubid2 = create_hub(&pool, name1, description1, "/callback", "password").unwrap();
        // Rename to existing name
        let update_result = update_hub_details(&pool, hubid2, name2, description2);
        compare_error("UNIQUE constraint failed: hub.name", update_result);
    }

    #[test]
    fn can_create_user_and_mail_telephone_needs_to_be_unique() {
        let (pool, delete) = set_up("can_create_user_and_mail_telephone_needs_to_be_unique");
        let mail1 = "mail1";
        let tel1 = "tel1";
        let config = &PepContext::test_config();
        let mail2 = "mail2";
        create_user(&pool, mail1, tel1, config, false);
        let user = get_user(&pool, mail1, tel1).unwrap().unwrap();
        assert!(user.active);
        assert_eq!(user.email, mail1);
        assert_eq!(user.telephone, tel1);
        assert_eq!(user.pseudonym.len(), 192);
        let not_unique = create_user(&pool, mail1, tel1, config, true);
        compare_error(
            "UNIQUE constraint failed: user.email, user.telephone",
            not_unique,
        );

        let user2 = get_user(&pool, mail2, tel1).unwrap();
        assert!(user2.is_none());

        create_user(&pool, mail2, tel1, config, false);
        let user2_really = get_user(&pool, mail2, tel1).unwrap().unwrap();
        assert_ne!(user2_really.id, user.id);
    }

    #[test]
    fn can_get_user_by_id() {
        let (pool, delete) = set_up("can_create_user_and_mail_telephone_needs_to_be_unique");
        let mail1 = "mail1";
        let tel1 = "tel1";
        let config = &PepContext::test_config();
        let mail2 = "mail2";
        create_user(&pool, mail1, tel1, config, false);

        create_user(&pool, mail2, tel1, config, false);
        let user = get_user_by_id(&pool, 1).unwrap();
        assert!(user.active);
        assert_eq!(user.email, mail1);
        assert_eq!(user.telephone, tel1);
        assert_eq!(user.pseudonym.len(), 192);
        let user2_really = get_user_by_id(&pool, 2).unwrap();
        assert_ne!(user2_really.id, user.id);
    }

    #[test]
    fn can_delete_user() {
        let (pool, delete) = set_up("can_create_user_and_mail_telephone_needs_to_be_unique");
        let mail = "mail1";
        let tel = "tel1";
        let config = &PepContext::test_config();
        create_user(&pool, mail, tel, config, false);
        let user = get_user(&pool, mail, tel).unwrap().unwrap();
        assert!(user.active);

        delete_user(&pool, mail, tel);
        let user_result = get_user(&pool, mail, tel);
        assert!(user_result.unwrap().is_none());

        let user = pool.query_row(
                "SELECT id, email, telephone, pseudonym, active, administrator FROM user WHERE email = ?1 AND telephone = ?2",
                [mail, tel],
                map_user,
            )
            .unwrap();
        assert!(!user.active)
    }

    #[test]
    fn can_update_user() {
        let (pool, delete) = set_up("can_create_user_and_mail_telephone_needs_to_be_unique");
        let mail = "mail1";
        let tel = "tel1";
        let config = &PepContext::test_config();
        create_user(&pool, mail, tel, config, false);
        let user = get_user(&pool, mail, tel).unwrap().unwrap();
        assert!(user.active);

        let new_mail = "mail2";
        let new_telephone = "tel2";
        let new_pseudonym = "pseudonym2";
        let updated_user = User {
            id: user.id,
            email: new_mail.to_string(),
            telephone: new_telephone.to_string(),
            pseudonym: new_pseudonym.to_string(),
            active: false,
            administrator: false,
        };
        update_user(&pool, updated_user);
        let stored_updated_user = get_user(&pool, new_mail, new_telephone).unwrap().unwrap();
        assert_eq!(stored_updated_user.email, new_mail);
        assert_eq!(stored_updated_user.telephone, new_telephone);
        assert_eq!(stored_updated_user.pseudonym, new_pseudonym);
        assert!(stored_updated_user.active);

        // Different user
        create_user(&pool, mail, tel, config, false);
        let new_id = get_user(&pool, mail, tel).unwrap().unwrap().id;
        // Update with existing telephone and email
        let updated_user_should_fail = User {
            id: new_id,
            email: new_mail.to_string(),
            telephone: new_telephone.to_string(),
            pseudonym: new_pseudonym.to_string(),
            active: false,
            administrator: false,
        };
        let update_result = update_user(&pool, updated_user_should_fail);
        compare_error(
            "UNIQUE constraint failed: user.email, user.telephone",
            update_result,
        )
    }

    #[test]
    fn migrations_increment_the_user_version() {
        let (pool, _delete) = set_up("migrations_increment_the_user_version");
        assert_eq!(schema_version(&pool).unwrap(), MIGRATIONS.len())
    }

    fn compare_error<T>(msg: &str, result: Result<T>)
    where
        T: Debug, /* required by unwrap_err */
    {
        assert!(
            result.is_err(),
            "got 'ok', but expected error with message {}",
            msg
        );

        let err = result.unwrap_err();
        assert_eq!(msg, err.to_string());
    }
}
