#!/usr/bin/env python3
# You can run this script locally in the docker container with
# ./conf/boot/update_config.py  --in 'data/homeserver.yaml' --out "$SYNAPSE_CONFIG_PATH" --environment="$UPDATE_CONFIG_ENV"
# SYNAPSE_CONFIG_PATH is where the generated file will be stored and also the yaml file that synaps will use to run
# The --environment can be either "development" or "production"
import yaml
from enum import Enum
from typing import Any, Callable
import argparse
import contextlib
import copy
import pathlib
from textwrap import dedent
from synapse.module_api.errors import ConfigError
import logging

logger = logging.getLogger(__name__)

HUB_CLIENT_API_MODULE = "conf.modules.pubhubs.HubClientApi"
CORE_MODULE = "conf.modules.pubhubs.Core"


def sqlite3_path_in(config: dict):
    """The sqlite3 database path configured in a parsed homeserver config, or None when the
    configured database engine is not sqlite3."""
    db = config.get('database') or {}
    if db.get('name') != 'sqlite3':
        return None
    return (db.get('args') or {}).get('database')


def module_named(homeserver: dict, name: str) -> dict | None:
    """The entry for module `name` in a homeserver config, or None when it is not listed."""
    for module in homeserver.get("modules") or []:
        if isinstance(module, dict) and module.get("module") == name:
            return module
    return None


class CheckEnvironment(Enum):
    DEVELOPMENT = "dont change"
    PRODUCTION = "change"


class UpdateConfig:
    """
    This class takes a hub homeserver.yaml file, checks it for malconfigurations and adds the
    settings PubHubs needs to function properly. The result is written as homeserver.live.yaml,
    which is the file Synapse actually runs with.

    Settings come in three kinds, each held in a dict below and applied by its own pass:

    DONT_CHANGE_CONFIG  Values PubHubs dictates. `_update_and_check_dont_change_config` injects
                        them when missing, and corrects or rejects them when a hub owner changed
                        them. It also drops settings PubHubs used in the past.

    DEFAULT_CONFIG      Values a hub owner need not configure, but may. `_apply_default_config`
                        only fills these in when absent, so an owner who did set them keeps
                        their own value.

    DO_CHANGE_CONFIG    Values an owner must change for production. `_check_did_change_config`
                        rejects the unchanged defaults in production, and rejects changed values
                        in development, where those defaults are what makes a testhub work.

    Adding a setting
    ----------------
    Add it to one of the dicts. That is enough for a value that is simply required to be equal
    to what PubHubs dictates. A setting that needs more than an equality check (because it is
    nested, or partly up to the owner) also needs an entry in `_dont_change_handlers`.
    """
    # WARNING: The structure of these dicts is similar to, but not exactly the same as, the
    #          structure of homeserver.yaml. Some are simplified so the checks stay readable:
    #          `modules` is a set of module names, `oidc_providers` holds the fields of the
    #          single provider rather than a list, and `server_notices` holds the localparts
    #          that are admissible rather than one value. Each of those has a handler in
    #          `_dont_change_handlers` that knows how to map it onto the real yaml shape.
    DONT_CHANGE_CONFIG = {
        "modules": {
            CORE_MODULE,
            "conf.modules.pubhubs.DBMigration",
            "conf.modules.pseudonyms.Pseudonym",
        },
        "oidc_providers": {
            "idp_id": "pubhubs",
            "idp_name": "PubHubs ID provider",
            "discover": False,
            "scopes": [],
            "client_id": "not used but must be set",
            "issuer": "https://example.com/not-used-but-must-be-set",
            "authorization_endpoint": "https://example.com/not-used-but-must-be-set",
            "token_endpoint": "https://example.com/not-used-but-must-be-set",
            "userinfo_endpoint": "https://example.com/not-used-but-must-be-set",
        },
        "federation_domain_whitelist": [],
        "allow_profile_lookup_over_federation": False,
        "allow_per_room_profiles": False,
        "enable_registration": False,
        "server_notices": {"system_mxid_localpart": ["notices_user", "notices"]},
        "password_config": {"enabled": False},
        "enable_authenticated_media": True,
        "trusted_key_servers": [],
        "update_profile_information": True,
        "room_list_publication_rules": [{"action": "allow"}],
        "sso": {"client_whitelist": ["https://app.pubhubs.net"]},
        # Users must be findable by everyone in the hub, also when they share no
        # room. Synapse defaults search_all_users and prefer_local_users to
        # False, which silently breaks user search, so these are enforced.
        "user_directory": {
            "enabled": True,
            "search_all_users": True,
            "prefer_local_users": True,
            "show_locked_users": False,
        },
    }
    # Settings a hub owner does not need to configure, but may. Unlike
    # DONT_CHANGE_CONFIG these are only filled in when absent: an owner who did
    # set them keeps their value. Overwriting media_store_path in particular
    # would orphan an existing media store.
    DEFAULT_CONFIG = {
        "report_stats": False,
        "pid_file": "/data/homeserver.pid",
        "media_store_path": "/data/media_store",
        # Rate limiting. Synapse's defaults assume a general-purpose Matrix
        # server and a few are too tight for how PubHubs is actually used. Each
        # setting is a token bucket: `burst_count` actions are allowed at once,
        # then the bucket refills at `per_second`. A hub owner who wants other
        # values can set the key in their own homeserver.yaml.
        #
        # Logins are keyed on the client's IP address, and hub users can arrive
        # from a shared campus/institutional NAT, so many distinct people
        # present the same IP. Synapse's default (burst 5, then 1 per 5.6 min)
        # would lock out the sixth person to log in from such a network within a
        # few minutes. failed_attempts is deliberately absent: it only throttles
        # *failed* password and UIA attempts, which PubHubs' OIDC login never
        # triggers, so raising it would only weaken brute-force protection.
        "rc_login": {
            "address": {"per_second": 1, "burst_count": 200},
            "account": {"per_second": 0.5, "burst_count": 20},
        },
        # Starting a new direct message creates a room, and room creation
        # charges both rc_room_creation and rc_message. The default (burst 10,
        # then 1 per 62.5 s) means a new user opening DMs with ten colleagues
        # hits a minute-long wall.
        "rc_room_creation": {"per_second": 0.1, "burst_count": 15},
        # Covers everything sent through /send: messages, edits, reactions and
        # redactions. Default is burst 10, then 1 per 5 s, which an active
        # conversation can exceed.
        "rc_message": {"per_second": 0.5, "burst_count": 15},
        # Joining public rooms. Default: burst 10, then 1 per 10 s.
        "rc_joins": {"local": {"per_second": 0.2, "burst_count": 15}},
        # per_user is keyed on the *receiver*, so it is spent by other people's
        # actions: at the default (burst 5, then 1 per 5.6 min) a steward who
        # gets DM'd by six people in five minutes starts rejecting invites, with
        # nothing they can do about it. per_issuer is keyed on the sender and is
        # the actual anti-spam control, so it stays at Synapse's default
        # (0.3 / burst 10), as does per_room.
        "rc_invites": {"per_user": {"per_second": 0.05, "burst_count": 15}},
    }
    DO_CHANGE_CONFIG = {
        "macaroon_secret_key": "macaroon_key",
        "server_name": "testhub.matrix.host",
        "public_baseurl": "http://localhost:8008",
    }
    EXAMPLE_CONFIG = {
        "modules": {
            "module": HUB_CLIENT_API_MODULE,
            "config": {
                "client_url": "http://localhost:8800",
            },
        },
    }
    # Settings and modules PubHubs used in the past, which have to be dropped from a hub
    # owner's configuration.
    RETIRED_SETTINGS = ("form_secret", "user_consent")
    RETIRED_MODULES = (
        "conf.modules.config_checker.ConfigChecker",
        "conf.modules.pubhubs.ConsentResource",
    )

    def __init__(self, config_env: str, hub_client_url, hub_server_url, global_client_url,
                 replace_sqlite3_by_postgres, server_name):
        self._hub_client_url = hub_client_url
        self._hub_server_url = hub_server_url
        self._global_client_url = global_client_url
        self._replace_sqlite3_by_postgres = replace_sqlite3_by_postgres
        self._server_name = server_name
        self._sqlite3_path = None
        # Resolved while applying `modules`, and needed afterwards to complete
        # sso.client_whitelist.
        self._resolved_global_client_url = None
        # The dicts above are class attributes, so work on deep copies: a run must never
        # mutate them, or a second run in the same process would start from mangled values.
        self._dont_change = copy.deepcopy(self.DONT_CHANGE_CONFIG)
        self._defaults = copy.deepcopy(self.DEFAULT_CONFIG)

        match config_env:
            case "production":
                self.check_environment = CheckEnvironment.PRODUCTION
            case "development":
                self.check_environment = CheckEnvironment.DEVELOPMENT
            case _:
                raise ValueError(f"❌  {config_env} is not a valid config environment init parameter for the UpdateConfig class")

    def load_and_update_config(self, homeserver_file_path: str) -> dict:
        """
        Return the updated homeserver_live.yaml config
        """
        try:
            with open(homeserver_file_path, "r") as f:
                homeserver = yaml.safe_load(f)
        except IOError as e:
            raise IOError(f"❌  Could not open configuration from {homeserver_file_path} file: {e}") from e
        except yaml.YAMLError as e:
            raise yaml.YAMLError(f"❌  Error while loading YAML file from {homeserver_file_path}: {e}") from e

        if not isinstance(homeserver, dict):
            raise ConfigError(f"❌  Expected {homeserver_file_path} to contain a mapping of settings, but got {homeserver} instead")

        # Work on a copy, so the caller's parsed configuration is left as it was.
        homeserver = copy.deepcopy(homeserver)

        if self._hub_server_url is not None:
            homeserver['public_baseurl'] = self._hub_server_url

        self._sqlite3_path = sqlite3_path_in(homeserver)

        if self._replace_sqlite3_by_postgres:
            self._maybe_replace_sqlite3_by_postgres(homeserver)

        homeserver_live = self._update_and_check_dont_change_config(homeserver)
        homeserver_live = self._apply_default_config(homeserver_live)
        homeserver_live = self._check_did_change_config(homeserver_live)

        return homeserver_live

    def _maybe_replace_sqlite3_by_postgres(self, homeserver: dict) -> None:
        """
        Rewrite a sqlite3 `database` section so Synapse uses the postgres that
        start_hub.py runs locally inside the container.

        If postgres (or any non-sqlite3 engine) is already configured, there is
        nothing to replace: the configuration is left untouched and
        `self._sqlite3_path` stays None, which signals start_hub.py to skip
        running postgres and the migration.
        """
        db = homeserver.get('database', {})
        dbname = db.get('name')
        if dbname != 'sqlite3':
            logger.info(f" - ℹ️  database is '{dbname}', not sqlite3; "
                        "leaving it unchanged (nothing to migrate to postgres)")
            return

        if self._sqlite3_path is None:
            raise ConfigError("❌  for --replace-sqlite3-by-postgres, "
                              "database.args.database must be configured, but it isn't")

        dbargs = db['args']
        db['name'] = 'psycopg2'
        for key in [k for k in dbargs if not k.startswith('cp_')]:
            del dbargs[key]
        dbargs['user'] = 'synapse'
        dbargs['dbname'] = 'hub'
        dbargs['host'] = '/var/run/postgresql'
        logger.info(" - ✅ replaced sqlite3 with postgres configuration")

    # -- settings PubHubs dictates -------------------------------------------------------

    def _dont_change_handlers(self) -> dict[str, Callable[[str, dict], None]]:
        """The settings that need more than an equality check. Anything in
        DONT_CHANGE_CONFIG without an entry here is handled by `_apply_required_value`."""
        return {
            "modules": self._apply_modules,
            "oidc_providers": self._apply_oidc_providers,
            "server_notices": self._apply_server_notices,
            "password_config": self._apply_password_config,
            "user_directory": self._apply_user_directory,
            "room_list_publication_rules": self._apply_room_list_publication_rules,
            "sso": self._apply_sso,
            # A wrong value here is corrected rather than rejected, because it does not
            # point at a hub owner misunderstanding something.
            "enable_authenticated_media": self._apply_corrected_value,
        }

    def _update_and_check_dont_change_config(self, homeserver: dict) -> dict:
        """
        Make sure every setting PubHubs dictates is present and has the value it should,
        and drop the settings PubHubs no longer uses.
        Return the updated homeserver_live dictionary.
        """
        homeserver_live = copy.deepcopy(homeserver)

        self._drop_retired_settings(homeserver_live)

        handlers = self._dont_change_handlers()

        # `modules` goes first, because it resolves the global client url that `sso` needs.
        with self._checking("modules"):
            self._apply_modules("modules", homeserver_live)

        for key in self._dont_change:
            if key == "modules":
                continue
            with self._checking(key):
                handlers.get(key, self._apply_required_value)(key, homeserver_live)

        return homeserver_live

    def _drop_retired_settings(self, homeserver_live: dict) -> None:
        for key in self.RETIRED_SETTINGS:
            if key in homeserver_live:
                del homeserver_live[key]
                logger.warning(f" - Warning ⚠️  {key} is a setting that is no longer used by Pubhubs, so the value was removed from the homeserver.yaml.live")

        # The consent resource was served by a module PubHubs no longer ships.
        for listener in homeserver_live.get("listeners") or []:
            if not isinstance(listener, dict):
                continue
            for resource in listener.get("resources") or []:
                if isinstance(resource, dict) and "consent" in (resource.get("names") or []):
                    resource["names"].remove("consent")
                    logger.warning(" - Warning ⚠️  listeners.resources.names has the value consent which is a setting that is no longer used by Pubhubs, so the value was removed from the homeserver.yaml.live")

    def _apply_required_value(self, key: str, homeserver_live: dict) -> None:
        """Inject the value PubHubs dictates, or reject a hub owner's different one."""
        expected = self._dont_change[key]
        if key not in homeserver_live:
            homeserver_live[key] = copy.deepcopy(expected)
            self._log_added(key, homeserver_live[key])
            return
        if homeserver_live[key] != expected:
            raise ConfigError(f"❌   {key} should have the value {expected} but is {homeserver_live[key]}")

    def _apply_corrected_value(self, key: str, homeserver_live: dict) -> None:
        """Inject the value PubHubs dictates, overwriting a different one."""
        expected = self._dont_change[key]
        if key not in homeserver_live:
            homeserver_live[key] = copy.deepcopy(expected)
            self._log_added(key, homeserver_live[key])
            return
        if homeserver_live[key] != expected:
            self._log_overwritten(key, homeserver_live[key], expected)
            homeserver_live[key] = copy.deepcopy(expected)

    def _apply_server_notices(self, key: str, homeserver_live: dict) -> None:
        """system_mxid_localpart may be either of two values, so this cannot be a plain
        equality check."""
        admissible = self._dont_change[key]["system_mxid_localpart"]
        if key not in homeserver_live or not isinstance(homeserver_live[key], dict):
            if key in homeserver_live:
                self._log_overwritten(key, homeserver_live[key], admissible[0])
            homeserver_live[key] = {"system_mxid_localpart": admissible[0]}
            return
        localpart = homeserver_live[key].get("system_mxid_localpart")
        if localpart is None:
            homeserver_live[key]["system_mxid_localpart"] = admissible[0]
        elif localpart not in admissible:
            raise ConfigError(f"❌   {key}.system_mxid_localpart should have one of the values {admissible} but is {localpart}")

    def _apply_password_config(self, key: str, homeserver_live: dict) -> None:
        """PubHubs accounts are provisioned over PHC and have no password."""
        expected = self._dont_change[key]["enabled"]
        if key not in homeserver_live or not isinstance(homeserver_live[key], dict):
            if key in homeserver_live:
                self._log_overwritten(key, homeserver_live[key], self._dont_change[key])
            homeserver_live[key] = {"enabled": expected}
            return
        if "enabled" not in homeserver_live[key]:
            homeserver_live[key]["enabled"] = expected
        elif homeserver_live[key]["enabled"] != expected:
            raise ConfigError(f"❌   {key}.enabled should have the value {expected} but is {homeserver_live[key]['enabled']}")

    def _apply_user_directory(self, key: str, homeserver_live: dict) -> None:
        """Enforce the settings PubHubs' user search depends on, while keeping any other
        user_directory settings the hub owner made."""
        required = self._dont_change[key]
        if key not in homeserver_live or not isinstance(homeserver_live[key], dict):
            if key in homeserver_live:
                self._log_overwritten(key, homeserver_live[key], required)
            homeserver_live[key] = copy.deepcopy(required)
            return
        for sub_key, expected in required.items():
            if homeserver_live[key].get(sub_key) != expected:
                self._log_overwritten(f"{key}.{sub_key}", homeserver_live[key].get(sub_key), expected)
                homeserver_live[key][sub_key] = expected

    def _apply_room_list_publication_rules(self, key: str, homeserver_live: dict) -> None:
        required = self._dont_change[key]
        value = homeserver_live.get(key)
        if key not in homeserver_live or not isinstance(value, list) or not value:
            if key in homeserver_live:
                self._log_overwritten(key, value, required)
            homeserver_live[key] = copy.deepcopy(required)
            return
        if "action" not in value[0]:
            value[0].update(required[0])
        elif value[0]["action"] != required[0]["action"]:
            raise ConfigError(f"❌   {key}.action should have the value {required[0]['action']} but is {value[0]['action']}")

    def _apply_oidc_providers(self, key: str, homeserver_live: dict) -> None:
        """
        Every field of the provider is dictated by PubHubs, so there is nothing for a hub
        owner to fill in and the whole section is injected when it is missing.

        Note homeserver.yaml expects a list of providers, while DONT_CHANGE_CONFIG holds
        the fields of the single provider PubHubs uses.
        """
        mandatory = self._dont_change[key]
        if key not in homeserver_live:
            homeserver_live[key] = [copy.deepcopy(mandatory)]
            self._log_added(key, homeserver_live[key])
            return

        providers = homeserver_live[key]
        if not isinstance(providers, list) or not providers:
            raise ConfigError(f"❌  Expected a non empty list for the {key} value, but got {providers} instead")
        if len(providers) != 1:
            raise ConfigError(f"❌   {key} should have exactly 1 provider but has {len(providers)} providers: {providers}")

        provider = providers[0]
        if not isinstance(provider, dict):
            raise ConfigError(f"❌  Expected a dict for the {key} list item value, but got {provider} instead")

        if "user_mapping_provider" in provider:
            logger.warning(f" - Warning ⚠️  outdated {key}.user_mapping_provider was removed")
            del provider["user_mapping_provider"]

        for field, expected in mandatory.items():
            if field in provider and provider[field] != expected:
                logger.warning(f" - Warning ⚠️  {key}.{field} has incorrect value - overwriting '{provider[field]}' with '{expected}'")
        provider.update(copy.deepcopy(mandatory))

    def _apply_sso(self, key: str, homeserver_live: dict) -> None:
        if key not in homeserver_live:
            homeserver_live[key] = copy.deepcopy(self._dont_change[key])
            self._log_added(key, homeserver_live[key])
        elif not isinstance(homeserver_live[key], dict):
            self._log_overwritten(key, homeserver_live[key], self._dont_change[key])
            homeserver_live[key] = {}
        self._ensure_sso_client_whitelist(homeserver_live)

    def _ensure_sso_client_whitelist(self, homeserver_live: dict) -> None:
        """
        Make sure sso.client_whitelist contains the global client, so that logging in
        redirects straight back to it instead of showing a confirmation page.

        Synapse matches the redirect url against the whitelist with str.startswith, so a
        whitelist entry acts as a url prefix.
        """
        global_client_url = self._resolved_global_client_url
        if global_client_url is None:
            raise RuntimeError("expected the global client url to be resolved while applying modules, but it isn't")
        if not global_client_url.endswith("/"):
            global_client_url += "/"

        sso = homeserver_live["sso"]
        whitelist = sso.get("client_whitelist")
        if not isinstance(whitelist, list) or not whitelist:
            sso["client_whitelist"] = [global_client_url]
            logger.info(f" - INFO ✅  set sso.client_whitelist to {sso['client_whitelist']} in new yaml file")
        elif global_client_url not in whitelist:
            sso["client_whitelist"] = whitelist + [global_client_url]
            logger.info(f" - INFO ✅  added {global_client_url} to sso.client_whitelist in new yaml file")

    # -- modules -------------------------------------------------------------------------

    def _apply_modules(self, key: str, homeserver_live: dict) -> None:
        """
        Add the PubHubs modules that are never changed, drop the ones PubHubs retired, and
        resolve the hub and global client urls the rest of the configuration needs.

        Unlike the other settings, `modules` cannot simply be injected: it carries the hub
        client url, which only the hub owner knows.
        """
        if key not in homeserver_live:
            raise ConfigError(f"❌  {key} setting should be present in homeserver.yaml but is missing, example: modules: {self.EXAMPLE_CONFIG['modules']}")

        modules = homeserver_live[key]
        if not isinstance(modules, list):
            raise ConfigError(f"❌  Expected a list for the {key} value, but got {modules} instead")
        for module in modules:
            if not isinstance(module, dict) or "module" not in module:
                raise ConfigError(f"❌  Expected every {key} entry to be a mapping with a 'module' key, but got {module} instead")

        # start_testhub.py passes the urls it just started the clients on.
        for module in modules:
            if module["module"] != HUB_CLIENT_API_MODULE:
                continue
            config = module.setdefault("config", {})
            if self._hub_client_url is not None:
                config["client_url"] = self._hub_client_url
            if self._global_client_url is not None:
                config["global_client_url"] = self._global_client_url

        # This script replaces the config checker, so drop it from older configurations.
        modules = [m for m in modules if m["module"] not in self.RETIRED_MODULES]

        present = {m["module"] for m in modules}
        # Sorted, so the generated file does not change order between runs.
        for name in sorted(self._dont_change[key]):
            if name in present:
                continue
            modules.append(self._new_module(name))

        homeserver_live[key] = modules
        self._resolve_client_urls(homeserver_live)

    def _new_module(self, name: str) -> dict:
        if name != CORE_MODULE:
            return {"module": name}
        phc_url = (
            "https://phc.pubhubs.net" if self.check_environment == CheckEnvironment.PRODUCTION
            else "http://host.docker.internal:5050"
        )
        return {"module": name, "config": {"phc_url": phc_url}}

    def _resolve_client_urls(self, homeserver_live: dict) -> None:
        """
        Check the hub client module's urls, and remember the global client url so
        `_ensure_sso_client_whitelist` can whitelist it.
        """
        hub_client_api = module_named(homeserver_live, HUB_CLIENT_API_MODULE)
        if hub_client_api is None or "config" not in hub_client_api:
            raise ConfigError(f"❌   {HUB_CLIENT_API_MODULE} and config should be present in a module but are missing")

        config = hub_client_api["config"]
        if "client_url" not in config:
            raise ConfigError("❌   config.client_url should be set but is missing")
        self._check_did_start_change(f"({HUB_CLIENT_API_MODULE}'s config).client_url", config["client_url"], "http://")

        if "global_client_url" in config:
            self._check_did_start_change(f"({HUB_CLIENT_API_MODULE}'s config).global_client_url", config["global_client_url"], "http://")
        elif self.check_environment == CheckEnvironment.DEVELOPMENT:
            raise ConfigError("❌   in development, global_client_url should have been set by start_testhub.py")
        else:
            config["global_client_url"] = "https://app.pubhubs.net"

        self._resolved_global_client_url = config["global_client_url"]

        # The Core module needs the hub client url too, and is always present because
        # _apply_modules adds it just above.
        core = module_named(homeserver_live, CORE_MODULE)
        if core is None:
            raise RuntimeError(f"expected {CORE_MODULE} to be added to the live config, but it isn't")
        core.setdefault("config", {}).setdefault("hub_client_url", config["client_url"])

    # -- settings a hub owner may configure ----------------------------------------------

    def _apply_default_config(self, homeserver_live: dict) -> dict:
        """
        Fill in DEFAULT_CONFIG settings that the hub owner did not configure.
        A value the owner did set is left alone.
        """
        for key, value in self._defaults.items():
            if key in homeserver_live:
                continue
            homeserver_live[key] = copy.deepcopy(value)
            self._log_added(key, homeserver_live[key])
        return homeserver_live

    # -- settings a hub owner must change ------------------------------------------------

    def _check_did_change_config(self, homeserver_live: dict) -> dict:
        """
        Check that the values that are supposed to be changed for production are changed,
        and that they are *not* changed for development, where the defaults are what makes
        a testhub work.
        """
        missing = [key for key in self.DO_CHANGE_CONFIG if key not in homeserver_live]
        if missing:
            raise ConfigError(f"❌   These values that are supposed to be set for the config are missing: {missing}")

        for key, default in self.DO_CHANGE_CONFIG.items():
            with self._checking(key, self.check_environment.value):
                match key:
                    case "server_name" if self._server_name is not None:
                        homeserver_live[key] = self._server_name
                    case "public_baseurl":
                        self._check_did_start_change(key, homeserver_live[key], "http://")
                    case _:
                        self._check_did_change(key, homeserver_live[key], default)
        return homeserver_live

    def _check_did_change(self, key: str, value: Any, default: str) -> None:
        """
        Check that the value has been changed from the default value in production or check that stayed the
        same as the default value in development
        """
        if value == default and self.check_environment == CheckEnvironment.PRODUCTION:
            raise ConfigError(
                f"❌   {key} was unchanged from {default}, but expected a different value than {value} for production"
            )
        if value != default and self.check_environment == CheckEnvironment.DEVELOPMENT:
            raise ConfigError(
                f"❌   {key} was changed from {default} to {value}, but expected the same value for development"
            )

    def _check_did_start_change(self, key: str, value: Any, default: str) -> None:
        """
        Check that the start of the value has been changed from the default value in production or check that the start stayed the
        same as the default value in development
        """
        if not isinstance(value, str):
            raise ConfigError(f"❌  Expected a str value for {key}, but got {value} instead")

        if value.startswith(default) and self.check_environment == CheckEnvironment.PRODUCTION:
            raise ConfigError(
                f"❌   {key}'s value ({value}) still starts with the string {default}, but it shouldn't in production"
            )
        if (
            not value.startswith(default)
            and self.check_environment == CheckEnvironment.DEVELOPMENT
        ):
            raise ConfigError(
                f"❌   {key} start was changed from {default} to {value}, but expected the same value  for development"
            )

    # -- helpers -------------------------------------------------------------------------

    @contextlib.contextmanager
    def _checking(self, key: str, what: str = "dont change"):
        """
        Wrap one setting's checks. A ConfigError is a hub owner's misconfiguration and is
        raised unchanged; anything else means this script hit a shape it did not expect, and
        is turned into a ConfigError too, since a hub owner reads these in the boot log.
        The original error stays attached as the cause.
        """
        try:
            yield
        except ConfigError:
            raise
        except Exception as e:
            raise ConfigError(f"❌   Configuration check failed for {key}: {e}") from e
        logger.info(f" - INFO ✅  {what} check succeeded for {key} in yaml file")

    def _log_added(self, key: str, value: Any) -> None:
        logger.info(f" - INFO ✅  added pubhubs setting for {key} in configuration  with value: {value} to new yaml file")

    def _log_overwritten(self, key: str, was: Any, now: Any) -> None:
        logger.warning(f" - Warning ⚠️  {key} was {was} which is incorrect, so the value was overwritten with the default pubhubs value to {now}")


def _configure_logging() -> None:
    """
    Send this script's output to stdout, so a hub owner sees it in the boot log.
    """
    logging.basicConfig(format='%(message)s', level=logging.INFO)


def main():
    parser = argparse.ArgumentParser(description='Update Synapse configuration.')
    parser.add_argument('--in', dest='input_file', required=True,
                       help='Input configuration file path')
    parser.add_argument('--out', dest='output_file', required=True,
                       help='Output configuration file path')
    parser.add_argument('--environment', required=True, choices=["", "production", "development"],
                       help='Determines what configuration changes are expected. ("" is interpreted as production.)')

    args = parser.parse_args()
    run(args.input_file, args.output_file, args.environment)


def run(input_file, output_file, environment,
        hub_client_url=None, hub_server_url=None, global_client_url=None,
        replace_sqlite3_by_postgres=None, server_name=None):
    _configure_logging()

    homeserver_file_path = input_file
    homeserver_live_file_path = output_file
    config_env = environment if environment != "" else 'production'

    # Update config homeserver, output as homeserver.live
    update_config_module = UpdateConfig(config_env,
                                        hub_client_url=hub_client_url,
                                        hub_server_url=hub_server_url,
                                        global_client_url=global_client_url,
                                        replace_sqlite3_by_postgres=replace_sqlite3_by_postgres,
                                        server_name=server_name)
    homeserver_live = update_config_module.load_and_update_config(homeserver_file_path)

    # Write updated config homeser.live to config path
    # Remove first \data folder because it is not present in the hub folder
    homeserver_live_parts = pathlib.Path(homeserver_live_file_path)
    homeserver_parts = pathlib.Path(homeserver_file_path)
    try:
        header = dedent(f"""\
            #  { pathlib.Path(*homeserver_live_parts.parts[2:]) } - Synapse homeserver configuration for this hub
            #
            # WARNING: Auto generated when the hub starts by `update_config.py.
            #          Any changes to this file will be lost when the hub (re)starts.
            #.         Please edit { pathlib.Path(*homeserver_parts.parts[2:]) } instead.
            #
            """
            )
        with open(homeserver_live_file_path, "w") as f:
            f.write(header)
        with open(homeserver_live_file_path, "a") as f:
            # sort_keys=False, so related settings stay together instead of being scattered
            # alphabetically; this file is what an operator reads to debug a failed boot.
            yaml.dump(homeserver_live, f, sort_keys=False)
    except IOError as e:
        raise IOError(f"❌  Could not write homeserver.live.yaml to {homeserver_live_file_path}: {e}") from e
    except yaml.YAMLError as e:
            raise yaml.YAMLError(f"❌  Error while saving homeserver.live dict to YAML: {e}") from e

    logger.info(f" - INFO ✅  Generated updated configuration of homeserver.yaml at {homeserver_live_file_path}")
    return update_config_module

if __name__ == "__main__":
    main()
