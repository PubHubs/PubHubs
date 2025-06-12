use crate::elgamal::Encoding as _;
use crate::pseudonyms::PepContext;
use anyhow::{Context as _, Result, anyhow, bail, ensure};
use expry::key_str;
use expry::{DecodedValue, value};

use prometheus::HistogramVec;
use rand::Rng;
use rand::distr::Alphanumeric;
use rusqlite::Error::QueryReturnedNoRows;
use rusqlite::{Connection, Row, params};
use serde::{Deserialize, Serialize};
use sha2::Digest as _;
use std::convert::AsRef;
use std::fmt::{Debug, Formatter};
use std::path::Path;
use std::str::FromStr;
use strum_macros::AsRefStr;
use tokio::sync::mpsc::Receiver;
use tokio::sync::oneshot;
use uuid::Uuid;

/// Trait for a database migration.  Implemented by `str` for simple SQL-statements.
///
/// See [MIGRATIONS] for more details.
trait Migration {
    /// Describes this migration, for error messages.
    fn describe(&'static self) -> &'static str;

    /// Performs the migration within the given database transaction.
    ///
    /// Does not update `user_version`.
    fn perform_in_tx(&'static self, tx: &rusqlite::Transaction) -> Result<()>;

    /// Performs the migration on the given database connection.
    ///
    /// Updates `user_version`.
    fn perform_on_db(&'static self, db: &mut Connection, next_migration_nr: usize) -> Result<()> {
        let tx = db.transaction()?;
        self.perform_in_tx(&tx)?;

        // Yes it's a formatted string, this is because rusqlite
        // does not let us make a prepared statement with PRAGMA. Fortunately it's a usize parameter.
        tx.execute(
            format!("PRAGMA user_version = {next_migration_nr}").as_str(),
            [],
        )?;
        tx.commit()?;
        Ok(())
    }
}

// NB. I tried, but could not let str (instead of &'static str) implement Migration,
// without causing "str is not Sized" errors when defining the MIGRATIONS array.
impl Migration for &'static str {
    fn perform_in_tx(&'static self, tx: &rusqlite::Transaction) -> Result<()> {
        tx.execute_batch(self)?;
        Ok(())
    }

    fn describe(&'static self) -> &'static str {
        self
    }
}

impl<T> Migration for (&'static str, T)
where
    T: Fn(&rusqlite::Transaction) -> Result<()>,
{
    fn perform_in_tx(&'static self, tx: &rusqlite::Transaction) -> Result<()> {
        self.1(tx)
    }

    fn describe(&'static self) -> &'static str {
        self.0
    }
}

fn schema_version(db: &Connection) -> Result<usize, rusqlite::Error> {
    db.query_row_and_then("PRAGMA user_version", [], |row| row.get(0))
}

/// Performs any missing migrations up_to but not including `up_to`.
/// If `up_to` is `None`, performs all missing migrations.
fn migrate_database(db: &mut Connection, do_migrations: DoMigrations) -> Result<()> {
    let next_version = schema_version(db)?;

    // up to, but not including
    let up_to: usize = match do_migrations {
        DoMigrations::All => MIGRATIONS.len(),
        DoMigrations::UpTo(up_to) => up_to,
    };

    #[allow(clippy::needless_range_loop)] // Clippy's suggestion is quite unreadable
    for i in next_version..up_to {
        let migration = MIGRATIONS[i];

        migration
            .perform_on_db(db, i + 1) // the next migration number is i+1
            .with_context(|| format!("while running migration #{i} {}", migration.describe()))?;
    }

    Ok(())
}

/// Add new DDL statements at end of this vector. Do not modify previous statements (unless you are completely
/// sure it does no harm.)
///
/// The migrations are numbered by their index from this array, and should be performed in order.
/// When migration n has been performed, the `user_version` is set to n+1.  So `user_version` must
/// be interpretted as the index of the next migration to be performed.
///
/// Since a blank database starts with `user_version=0`, migration number 0 will be performed first.
const MIGRATIONS: [&dyn Migration; 12] = [
    &"
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
    &"
        ALTER TABLE user ADD administrator INTEGER NOT NULL DEFAULT 0; 
        ", //0 is the value for a boolean false
    &"
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
    &"
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
    &"
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
    // passphrase no longer needed
    &"ALTER TABLE hub DROP COLUMN passphrase;",
    // add bar state; NB: sha256("")="e3b0[...]"
    &"ALTER TABLE user ADD bar_state BLOB DEFAULT X'' NOT NULL;",
    &"ALTER TABLE user ADD bar_state_etag TEXT DEFAULT \"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\" NOT NULL;",
    &"ALTER TABLE hub RENAME COLUMN redirection_uri TO oidc_redirect_uri;", // #8
    &("adding client_uri to hub", migration_add_client_uri),                // #9
    &"ALTER TABLE user ADD registration_date TEXT DEFAULT 'older card' NOT NULL;", //#10
    &("add external id to user", migration_add_user_external_id),           //#11
];

/// Adds `client_uri` field to hub, with as initial value the `oidc_redirect_uri` but with path,
/// query and fragment cleared.
fn migration_add_client_uri(tx: &rusqlite::Transaction) -> Result<()> {
    tx.execute(
        "ALTER TABLE hub ADD client_uri TEXT NOT NULL DEFAULT ''",
        [],
    )?;

    let mut select_stmt = tx.prepare("SELECT id, oidc_redirect_uri from hub")?;

    let rows = select_stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let oidc_redirect_uri: String = row.get(1)?;

        Ok((id, oidc_redirect_uri))
    })?;

    let mut update_stmt = tx.prepare("UPDATE hub SET client_uri = :uri WHERE id = :id")?;

    for row_result in rows {
        let (id, oidc_redirect_uri) = row_result?;

        let mut uri = url::Url::parse(&oidc_redirect_uri)?;
        uri.set_path("");
        uri.set_query(None);
        uri.set_fragment(None);

        update_stmt.execute(rusqlite::named_params! { ":id": id, ":uri": uri.to_string()})?;
    }

    Ok(())
}

fn migration_add_user_external_id(tx: &rusqlite::Transaction) -> Result<()> {
    tx.execute(
        "ALTER TABLE user ADD external_id TEXT DEFAULT '' NOT NULL;",
        [],
    )?;

    let mut update_stmt =
        tx.prepare("UPDATE user SET external_id = :external_id WHERE id = :id")?;

    tx.prepare("SELECT id FROM user")?
        .query_map([], |row| {
            let id: u32 = row.get(0).expect("Every user should have an id");
            Ok(id)
        })?
        .for_each(|id| {
            let id = id.expect("An id is mandatory for a user");

            let external_id = generate_external_id();
            update_stmt
                .execute(rusqlite::named_params! { ":id": id, ":external_id": external_id})
                .expect("Expected to finish the migration");
        });

    tx.execute(
        "CREATE UNIQUE INDEX idx_user_external_id ON user (external_id);",
        [],
    )?;
    Ok(())
}

#[derive(Debug, AsRefStr)]
#[allow(clippy::large_enum_variant)] // Not worth fixing
pub enum DataCommands {
    AllHubs {
        resp: oneshot::Sender<Result<Vec<Hub>>>,
    },
    CreateHub {
        name: String,
        description: String,
        oidc_redirect_uri: String,
        client_uri: String,
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
        oidc_redirect_uri: String,
        client_uri: String,
    },
    AllUsers {
        resp: oneshot::Sender<Result<Vec<User>>>,
    },
    CreateUser {
        resp: oneshot::Sender<Result<User>>,
        email: String,
        telephone: String,
        registration_date: String,
        config: PepContext,
        is_admin: bool,
    },
    GetUser {
        resp: oneshot::Sender<Result<User>>,
        email: String,
        telephone: String,
    },
    GetUserById {
        resp: oneshot::Sender<Result<User>>,
        id: String,
    },
    GetBarState {
        resp: oneshot::Sender<Result<BarState>>,
        id: String,
    },
    // Updates bar_state to `state` if the current state has etag `old_etag` in which case
    // `Ok(Some(etag))` is returned where `etag` is the new etag.  Otherwise, when `old_etag` is
    // outdated, `Ok(None)` is returned.
    UpdateBarState {
        resp: oneshot::Sender<Result<Option<String>>>,
        id: String,
        old_etag: String,
        state: bytes::Bytes,
    },
    // #[cfg(test)] // does not work for the binary
    Terminate {},
}

pub fn make_database_manager<P: AsRef<Path>>(
    path: P,
    rx: Receiver<DataCommands>,
    database_req_histogram: HistogramVec,
) {
    // can't pass reference to new thread
    let path = path.as_ref().to_path_buf();

    tokio::spawn(async move {
        let manager = get_manager(path).expect("A database connection");
        handle_command(rx, manager, database_req_histogram).await
    });
}

pub fn make_in_memory_database_manager(
    rx: Receiver<DataCommands>,
    database_req_histogram: HistogramVec,
) {
    tokio::spawn(async move {
        let manager = get_connection_memory(DoMigrations::All)
            .expect("A connection to an in-memory database");
        handle_command(rx, manager, database_req_histogram).await
    });
}

async fn handle_command(
    mut rx: Receiver<DataCommands>,
    manager: Connection,
    database_req_histogram: HistogramVec,
) {
    while let Some(cmd) = rx.recv().await {
        let timer = database_req_histogram
            .with_label_values(&[cmd.as_ref()])
            .start_timer();
        match cmd {
            DataCommands::AllHubs { resp } => {
                let hubs = get_all_hubs(&manager);
                resp.send(hubs).expect("To use our channel");
            }
            DataCommands::CreateHub {
                name,
                description,
                oidc_redirect_uri,
                client_uri,
                resp,
            } => {
                resp.send(create_hub(
                    &manager,
                    &name,
                    &description,
                    &oidc_redirect_uri,
                    &client_uri,
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
                oidc_redirect_uri,
                client_uri,
            } => {
                resp.send(update_hub_details(
                    &manager,
                    id,
                    &name,
                    &description,
                    &oidc_redirect_uri,
                    &client_uri,
                ))
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
                registration_date,
                config,
                is_admin,
            } => {
                resp.send(create_user(
                    &manager,
                    &email,
                    &telephone,
                    &registration_date,
                    &config,
                    is_admin,
                ))
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
            DataCommands::GetBarState { resp, id } => resp
                .send(get_bar_state(&manager, id))
                .expect("Trying to use the data channel"),
            DataCommands::UpdateBarState {
                resp,
                id,
                old_etag,
                state,
            } => resp
                .send(update_bar_state(&manager, id, old_etag, state))
                .expect("Trying to use the data channel"),
            //#[cfg(test)]
            DataCommands::Terminate {} => break,
        }
        timer.stop_and_record();
    }
}

/// Fetch a pool to a database located at the given path. Will initialize the database with the correct schemas if not created yet.
pub fn get_manager<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let mut manager = Connection::open(path)?;
    migrate_database(&mut manager, DoMigrations::All)?;
    Ok(manager)
}

/// Specify which migrations to perform.
pub enum DoMigrations {
    All,
    /// up to, but not including, the migration with this number
    UpTo(usize),
}

/// Creates a blank in-mempory database, and applies all migrations to it up to (but not including)
/// number `migrate_up_to`.  Performs all migrations if `migrate_up_to` is `None`.
pub fn get_connection_memory(do_migrations: DoMigrations) -> Result<Connection> {
    let mut manager = Connection::open_in_memory()?;
    migrate_database(&mut manager, do_migrations)?;
    Ok(manager)
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
    pub oidc_redirect_uri: String,
    pub client_uri: String,
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

        impl serde::de::Visitor<'_> for Visitor {
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

    /// Given the [crate::oidc::Oidc] instance, returns the oidc client credentials for this hub.
    pub fn oidc_credentials(
        &self,
        oidc: &impl crate::oidc::Oidc,
    ) -> crate::oidc::ClientCredentials {
        oidc.generate_client_credentials(&self.name, &self.oidc_redirect_uri)
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
        value!({
            "id": v.id.data,
            "name": v.name,
            "description": v.description,
            "oidc_redirect_uri": v.oidc_redirect_uri,
            "client_uri": v.client_uri,
        })
    }
}

pub fn create_hub(
    db: &Connection,
    name: &str,
    description: &str,
    oidc_redirect_uri: &str,
    client_uri: &str,
) -> Result<Hubid> {
    let hubid = Hubid::new();
    let decryption_id = Hubid::new();

    let rows_changed = db.execute(
        "INSERT INTO hub (name, description, oidc_redirect_uri,  active, id, decryption_id, client_uri)
        values (:name, :description, :oidc_redirect_uri, TRUE, :hubid, :decryption_id, :client_uri)",
        rusqlite::named_params!{
            ":name": name,
            ":description": description, 
            ":oidc_redirect_uri": oidc_redirect_uri, 
            ":hubid": hubid, 
            ":decryption_id": decryption_id,
            ":client_uri": client_uri,
        }
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
        oidc_redirect_uri: row.get(4)?,
        client_uri: row.get(5)?,
        active: row.get(6)?,
    })
}

/// Get a hub by id if it's active.
pub fn get_hub(db: &Connection, handle: HubHandle) -> Result<Hub> {
    let query = format!(
        "SELECT id, decryption_id, name, description, oidc_redirect_uri, client_uri, active FROM hub
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
        "SELECT id, decryption_id, name, description, oidc_redirect_uri, client_uri, active FROM hub WHERE active = TRUE",
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
    oidc_redirect_uri: &str,
    client_uri: &str,
) -> Result<Hub> {
    let rows_changed = db.execute(
        "UPDATE hub
        SET name = :name, description = :description, oidc_redirect_uri = :oidc_redirect_uri, client_uri = :client_uri
        WHERE active = TRUE AND id = :id",
        rusqlite::named_params!{
            ":name": name, 
            ":description": description,
            ":id": id.to_string(),
            ":oidc_redirect_uri": oidc_redirect_uri,
            ":client_uri": client_uri,
        }
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
    pub external_id: String,
    pub email: String,
    pub telephone: String,
    pub pseudonym: String,
    pub registration_date: String,
    pub active: bool,
    pub administrator: bool,
    // NOTE: the 'bar_state*' fields are stored in the BarState struct instead
}

#[derive(PartialEq, Eq, Debug)]
pub struct BarState {
    pub state: Vec<u8>,
    pub state_etag: String,
}

impl Debug for User {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("User")
            .field("id", &self.external_id)
            .field("active", &self.active)
            .field("administrator", &self.administrator)
            .finish()
    }
}

impl<'a> From<&'a User> for DecodedValue<'a> {
    fn from(user: &'a User) -> Self {
        value!({"id": user.external_id, "email": user.email, "telephone": user.telephone})
    }
}

pub fn create_user(
    db: &Connection,
    email: &str,
    telephone: &str,
    registration_date: &str,
    pep: &PepContext,
    is_admin: bool,
) -> Result<User> {
    let user_id = generate_external_id();

    db.execute(
        "INSERT INTO user (email, telephone, registration_date, pseudonym, active, administrator, external_id)
        values (?1, ?2, ?3, ?4, TRUE, ?5, ?6)",
        params![
            email,
            telephone,
            registration_date,
            pep.generate_pseudonym().to_hex(),
            is_admin,
            user_id
        ],
    )?;
    get_user(db, email, telephone)
}

fn generate_external_id() -> String {
    let user_id: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect();
    user_id
}

pub fn get_user(db: &Connection, email: &str, telephone: &str) -> Result<User> {
    match db.query_row(
        "SELECT external_id, email, telephone, pseudonym, registration_date, active, administrator FROM user
        WHERE active = TRUE AND email = ?1 AND telephone = ?2",
        [email, telephone],
        map_user,
    ) {
        Ok(user) => Ok(user),
        Err(err) => bail!(err),
    }
}

pub fn get_user_by_id(db: &Connection, id: String) -> Result<User> {
    let result = db.query_row(
        "SELECT external_id, email, telephone, pseudonym, registration_date, active, administrator FROM user
        WHERE active = TRUE AND external_id = ?1",
        [id],
        map_user,
    )?;
    Ok(result)
}

pub fn get_bar_state(db: &Connection, id: String) -> Result<BarState> {
    db.query_row(
        "SELECT bar_state, bar_state_etag FROM user WHERE active = TRUE and external_id = ?1",
        [id],
        map_bar_state,
    )
    .context("getting bar state from database")
}

pub fn update_bar_state(
    db: &Connection,
    id: String,
    old_etag: String,
    state: bytes::Bytes,
) -> Result<Option<String>> {
    let new_etag: String = base16ct::lower::encode_string(
        sha2::Sha256::new()
            .chain_update(&state)
            .finalize()
            .as_slice(),
    );

    match db.execute(
        "UPDATE user SET bar_state = :bar_state, bar_state_etag = :new_etag WHERE external_id = :id AND bar_state_etag = :old_etag;",
        rusqlite::named_params! {
            ":bar_state": &*state, // &* = bytes.Bytes -> &[u8]
            ":new_etag": new_etag,
            ":id": id,
            ":old_etag": old_etag,
        },
    )? {
        1 => Ok(Some(new_etag)),
        _ => Ok(None),
    }
}

pub fn get_all_users(db: &Connection) -> Result<Vec<User>> {
    let mut stmt =
        db.prepare("SELECT external_id, email, telephone, pseudonym, registration_date, active, administrator FROM user WHERE active = TRUE")?;
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
        WHERE active = TRUE AND external_id = ?4",
        [user.email, user.telephone, user.pseudonym, user.external_id],
    )?;
    Ok(result)
}

fn map_user(row: &Row) -> Result<User, rusqlite::Error> {
    Ok(User {
        external_id: row.get(0)?,
        email: row.get(1)?,
        telephone: row.get(2)?,
        pseudonym: row.get(3)?,
        registration_date: row.get(4)?,
        active: row.get(5)?,
        administrator: row.get(6)?,
    })
}

fn map_bar_state(row: &Row) -> Result<BarState, rusqlite::Error> {
    Ok(BarState {
        state: row.get(0)?,
        state_etag: row.get(1)?,
    })
}

pub fn no_result(e: &anyhow::Error) -> bool {
    e.root_cause().to_string().as_str() == QueryReturnedNoRows.to_string().as_str()
}

#[cfg(test)]
#[allow(unused_variables)]
#[allow(unused_must_use)]
mod tests {
    use super::*;

    fn set_up() -> Connection {
        get_connection_memory(DoMigrations::All).unwrap()
    }

    #[test]
    fn hub_client_uri_migration() {
        // initialize a database, and do all migrations up to but not including 'migration_add_client_uri'
        let mut conn = get_connection_memory(DoMigrations::UpTo(9)).unwrap();

        let hub_id1 = Hubid::new();

        {
            let mut insert_stmt = conn
            .prepare(
                "INSERT INTO hub (name, description, oidc_redirect_uri, active, id, decryption_id)
            VALUES (:name, :description, :oidc_redirect_uri, TRUE, :id, :decryption_id)",
            )
            .unwrap();

            insert_stmt
            .execute(rusqlite::named_params! {
                ":name": "hub1",
                ":description": "hub1 description",
                ":oidc_redirect_uri": "https://some-url.com/_synapse/somthing?or_other#fragment",
                ":id": hub_id1,
                ":decryption_id": "",
            })
            .unwrap();

            insert_stmt
            .execute(rusqlite::named_params! {
                ":name": "hub2",
                ":description": "hub2 description",
                ":oidc_redirect_uri": "https://some-other-url.com/_synapse/somthing?or_other#fragment",
                ":id": Hubid::new(),
                ":decryption_id": "",
            })
            .unwrap();
        }

        migrate_database(&mut conn, DoMigrations::UpTo(10)).unwrap();

        assert_eq!(
            &conn
                .query_row(
                    "SELECT client_uri FROM hub WHERE id=:id",
                    rusqlite::named_params! {
                    ":id": hub_id1,
                    },
                    |row: &Row| {
                        let oidc_redirect_uri: String = row.get(0)?;
                        Ok(oidc_redirect_uri)
                    }
                )
                .unwrap(),
            "https://some-url.com/"
        );
    }

    #[test]
    fn can_create_hub_and_name_needs_to_be_unique() {
        let pool = set_up();
        let name1 = "hub1";
        let description1 = "description1";
        let name2 = "hub2";
        let description2 = "description2";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "client").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert!(hub.active);
        assert_eq!(hub.pseudonymisation_context(), format!("Hub #{}", hubid1)); // DO NOT CHANGE the pseudonymisation_context lest all local pseudonyms will change
        assert_eq!(
            hub.decryption_context(),
            format!("Hub decryption key #{}", hub.decryption_id)
        );
        assert_eq!(hub.name, name1);
        let not_unique = create_hub(&pool, name1, description1, "/callback", "client");
        compare_error("UNIQUE constraint failed: hub.name", not_unique);

        let hubid2 = create_hub(&pool, name2, description2, "/callback", "client").unwrap();
        let hub2_really = get_hub(&pool, HubHandle::Id(hubid2)).unwrap();
        assert_eq!(hub2_really.id, hubid2);
    }

    #[test]
    fn can_delete_hub() {
        let pool = set_up();
        let name1 = "hub1";
        let description1 = "description1";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "client").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert!(hub.active);
        delete_hub(&pool, hubid1);
        let hub_result = get_hub(&pool, HubHandle::Id(hubid1));
        compare_error("Query returned no rows", hub_result);

        let hub = pool
            .query_row(
                "SELECT id, decryption_id, name, description, oidc_redirect_uri, client_uri,active FROM hub WHERE name = ?1",
                [name1],
                map_hub,
            )
            .unwrap();
        assert!(!hub.active)
    }

    #[test]
    fn can_update_hub_name() {
        let pool = set_up();
        let name1 = "hub1";
        let description1 = "description1";
        let hubid1 = create_hub(&pool, name1, description1, "/callback", "client").unwrap();
        let hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert_eq!(hub.name, name1);
        assert_eq!(hub.oidc_redirect_uri, "/callback");
        assert_eq!(hub.client_uri, "client");
        let name2 = "name2";
        let description2 = "description2";
        update_hub_details(&pool, hubid1, name2, description2, "/callback2", "client2");
        let updated_hub = get_hub(&pool, HubHandle::Id(hubid1)).unwrap();
        assert_eq!(updated_hub.name, name2);
        assert_eq!(updated_hub.oidc_redirect_uri, "/callback2");
        assert_eq!(updated_hub.client_uri, "client2");

        // Different hub
        let hubid2 = create_hub(&pool, name1, description1, "/callback", "client").unwrap();
        // Rename to existing name
        let update_result = update_hub_details(&pool, hubid2, name2, description2, "some", "thing");
        compare_error("UNIQUE constraint failed: hub.name", update_result);
    }

    #[test]
    fn can_create_user_and_mail_telephone_needs_to_be_unique() {
        let pool = set_up();
        let mail1 = "mail1";
        let tel1 = "tel1";
        let config = &PepContext::test_config();
        let mail2 = "mail2";
        let date = "today";
        create_user(&pool, mail1, tel1, date, config, false).unwrap();
        let user = get_user(&pool, mail1, tel1).unwrap();
        assert!(user.active);
        assert_eq!(user.email, mail1);
        assert_eq!(user.telephone, tel1);
        assert_eq!(user.pseudonym.len(), 192);
        let not_unique = create_user(&pool, mail1, tel1, date, config, true);
        compare_error(
            "UNIQUE constraint failed: user.email, user.telephone",
            not_unique,
        );

        let user2 = get_user(&pool, mail2, tel1);
        match user2 {
            Err(e) if no_result(&e) => assert!(true),
            _ => assert!(false),
        }

        create_user(&pool, mail2, tel1, date, config, false);
        let user2_really = get_user(&pool, mail2, tel1).unwrap();
        assert_ne!(user2_really.external_id, user.external_id);
    }

    #[test]
    fn can_get_user_by_id() {
        let pool = set_up();
        let mail1 = "mail1";
        let tel1 = "tel1";
        let config = &PepContext::test_config();
        let mail2 = "mail2";
        let date = "today";
        create_user(&pool, mail1, tel1, date, config, false);

        create_user(&pool, mail2, tel1, date, config, false);
        let user = get_user_by_internal_id(&pool, 1).unwrap();
        assert!(user.active);
        assert_eq!(user.email, mail1);
        assert_eq!(user.telephone, tel1);
        assert_eq!(user.pseudonym.len(), 192);
        let user2_really = get_user_by_internal_id(&pool, 2).unwrap();
        assert_ne!(user2_really.external_id, user.external_id);
    }

    #[test]
    fn can_delete_user() {
        let pool = set_up();
        let mail = "mail1";
        let tel = "tel1";
        let date = "today";
        let config = &PepContext::test_config();
        create_user(&pool, mail, tel, date, config, false);
        let user = get_user(&pool, mail, tel).unwrap();
        assert!(user.active);

        delete_user(&pool, mail, tel);
        let user_result = get_user(&pool, mail, tel);
        match user_result {
            Err(e) if no_result(&e) => assert!(true),
            _ => assert!(false),
        }

        let user = pool.query_row(
                "SELECT external_id, email, telephone, pseudonym, registration_date, active, administrator FROM user WHERE email = ?1 AND telephone = ?2",
                [mail, tel],
                map_user,
            )
            .unwrap();
        assert!(!user.active)
    }

    #[test]
    fn can_update_user() {
        let pool = set_up();
        let mail = "mail1";
        let tel = "tel1";
        let date = "today";
        let config = &PepContext::test_config();
        create_user(&pool, mail, tel, date, config, false);
        let user = get_user(&pool, mail, tel).unwrap();
        assert!(user.active);

        let new_mail = "mail2";
        let new_telephone = "tel2";
        let new_pseudonym = "pseudonym2";
        let updated_user = User {
            external_id: user.external_id,
            email: new_mail.to_string(),
            telephone: new_telephone.to_string(),
            pseudonym: new_pseudonym.to_string(),
            registration_date: "today".to_string(),
            active: false,
            administrator: false,
        };
        update_user(&pool, updated_user);
        let stored_updated_user = get_user(&pool, new_mail, new_telephone).unwrap();
        assert_eq!(stored_updated_user.email, new_mail);
        assert_eq!(stored_updated_user.telephone, new_telephone);
        assert_eq!(stored_updated_user.pseudonym, new_pseudonym);
        assert!(stored_updated_user.active);

        // Different user
        create_user(&pool, mail, tel, date, config, false);
        let new_id = get_user(&pool, mail, tel).unwrap().external_id;
        // Update with existing telephone and email
        let updated_user_should_fail = User {
            external_id: new_id,
            email: new_mail.to_string(),
            telephone: new_telephone.to_string(),
            pseudonym: new_pseudonym.to_string(),
            registration_date: "today".to_string(),
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
        let pool = set_up();
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

    fn get_user_by_internal_id(db: &Connection, id: u32) -> Result<User> {
        let result = db.query_row(
            "SELECT external_id, email, telephone, pseudonym, registration_date, active, administrator FROM user
        WHERE active = TRUE AND id = ?1",
            [id],
            map_user,
        )?;
        Ok(result)
    }
}
