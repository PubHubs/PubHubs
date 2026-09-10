"""Tests for boot/update_config.py, which turns a hub owner's homeserver.yaml into the
homeserver.live.yaml Synapse actually runs with.

This script gates every hub boot: if it is wrong, hubs either fail to start or start
misconfigured. The tests below pin down the three kinds of settings it deals with:

  DONT_CHANGE_CONFIG  values PubHubs dictates; injected when missing, corrected or
                      rejected when a hub owner changed them
  DEFAULT_CONFIG      values a hub owner need not configure; injected only when absent,
                      so an owner who did set them keeps their own value
  DO_CHANGE_CONFIG    values an owner must change for production, and must leave alone
                      for development
"""

import logging
import os
import sys
import tempfile
import unittest

import yaml

sys.path.append("boot")
import update_config
from update_config import UpdateConfig, sqlite3_path_in
from synapse.module_api.errors import ConfigError

GLOBAL_CLIENT_URL = "http://localhost:8080"
HUB_CLIENT_URL = "http://localhost:8001"


def setUpModule():
    # update_config logs a line per check, and configures logging when run() is used.
    # The handler makes that configuration a no-op, so the suite stays quiet.
    logging.getLogger().addHandler(logging.NullHandler())
    logging.getLogger().setLevel(logging.CRITICAL)


def base_config(**overrides) -> dict:
    """A minimal homeserver.yaml that passes every check in the development environment."""
    config = {
        "modules": [
            {
                "module": "conf.modules.pubhubs.HubClientApi",
                "config": {"client_url": HUB_CLIENT_URL},
            }
        ],
        "server_name": "testhub.matrix.host",
        "public_baseurl": "http://localhost:8008",
        "macaroon_secret_key": "macaroon_key",
    }
    config.update(overrides)
    return config


def production_config(**overrides) -> dict:
    """A homeserver.yaml with every DO_CHANGE value actually changed."""
    config = base_config(
        server_name="hub.example.org",
        public_baseurl="https://hub.example.org",
        macaroon_secret_key="a-real-generated-secret",
    )
    config["modules"][0]["config"]["client_url"] = "https://client.example.org"
    config["modules"][0]["config"]["global_client_url"] = "https://app.example.org"
    config.update(overrides)
    return config


def generate(config: dict, environment: str = "development", **kwargs) -> dict:
    """Run update_config over `config` and return the resulting live config."""
    kwargs.setdefault("hub_client_url", None)
    kwargs.setdefault("hub_server_url", None)
    kwargs.setdefault("replace_sqlite3_by_postgres", None)
    kwargs.setdefault("server_name", None)
    if environment == "development":
        kwargs.setdefault("global_client_url", GLOBAL_CLIENT_URL)
    else:
        kwargs.setdefault("global_client_url", None)

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "homeserver.yaml")
        with open(path, "w") as f:
            yaml.safe_dump(config, f, sort_keys=False)
        return UpdateConfig(environment, **kwargs).load_and_update_config(path)


def module_named(live: dict, name: str) -> dict | None:
    for module in live["modules"]:
        if module.get("module") == name:
            return module
    return None


class DontChangeConfigTest(unittest.TestCase):
    """Settings PubHubs dictates, so they are injected when missing."""

    def test_missing_settings_are_injected(self):
        live = generate(base_config())
        self.assertEqual(live["federation_domain_whitelist"], [])
        self.assertIs(live["allow_profile_lookup_over_federation"], False)
        self.assertIs(live["allow_per_room_profiles"], False)
        self.assertIs(live["enable_registration"], False)
        self.assertIs(live["enable_authenticated_media"], True)
        self.assertIs(live["update_profile_information"], True)
        self.assertEqual(live["trusted_key_servers"], [])
        self.assertEqual(live["room_list_publication_rules"], [{"action": "allow"}])
        self.assertEqual(live["password_config"], {"enabled": False})
        self.assertEqual(live["server_notices"], {"system_mxid_localpart": "notices_user"})

    def test_password_login_is_disabled(self):
        """PubHubs accounts are OIDC provisioned and have no password."""
        self.assertIs(generate(base_config())["password_config"]["enabled"], False)

    def test_changed_value_is_rejected(self):
        for key, bad_value in (
            ("federation_domain_whitelist", ["example.org"]),
            ("allow_profile_lookup_over_federation", True),
            ("allow_per_room_profiles", True),
            ("enable_registration", True),
            ("trusted_key_servers", [{"server_name": "matrix.org"}]),
            ("update_profile_information", False),
        ):
            with self.subTest(key=key):
                with self.assertRaises(ConfigError):
                    generate(base_config(**{key: bad_value}))

    def test_password_config_enabled_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(password_config={"enabled": True}))

    def test_server_notices_accepts_both_admissible_localparts(self):
        for localpart in ("notices_user", "notices"):
            with self.subTest(localpart=localpart):
                live = generate(base_config(server_notices={"system_mxid_localpart": localpart}))
                self.assertEqual(live["server_notices"]["system_mxid_localpart"], localpart)

    def test_server_notices_rejects_other_localparts(self):
        with self.assertRaises(ConfigError):
            generate(base_config(server_notices={"system_mxid_localpart": "something_else"}))

    def test_enable_authenticated_media_is_corrected(self):
        live = generate(base_config(enable_authenticated_media=False))
        self.assertIs(live["enable_authenticated_media"], True)

    def test_room_list_publication_rules_wrong_action_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(room_list_publication_rules=[{"action": "deny"}]))


class UserDirectoryTest(unittest.TestCase):
    """Users must be findable hub-wide, also when they share no room. Synapse defaults
    search_all_users and prefer_local_users to False, which silently breaks user search."""

    def test_injected_when_missing(self):
        self.assertEqual(
            generate(base_config())["user_directory"],
            {
                "enabled": True,
                "search_all_users": True,
                "prefer_local_users": True,
                "show_locked_users": False,
            },
        )

    def test_required_settings_are_corrected(self):
        live = generate(base_config(user_directory={"enabled": True, "search_all_users": False}))
        self.assertIs(live["user_directory"]["search_all_users"], True)
        self.assertIs(live["user_directory"]["prefer_local_users"], True)

    def test_other_settings_are_preserved(self):
        live = generate(
            base_config(user_directory={"search_all_users": True, "exclude_remote_users": True})
        )
        self.assertIs(live["user_directory"]["exclude_remote_users"], True)

    def test_non_dict_is_replaced(self):
        live = generate(base_config(user_directory="nonsense"))
        self.assertIs(live["user_directory"]["search_all_users"], True)


class DefaultConfigTest(unittest.TestCase):
    """Settings a hub owner need not configure, but may: injected only when absent."""

    def test_injected_when_missing(self):
        live = generate(base_config())
        self.assertIs(live["report_stats"], False)
        self.assertEqual(live["pid_file"], "/data/homeserver.pid")
        self.assertEqual(live["media_store_path"], "/data/media_store")

    def test_owner_values_are_preserved(self):
        """Overwriting media_store_path would orphan an existing media store."""
        live = generate(
            base_config(
                report_stats=True,
                pid_file="/srv/hub/homeserver.pid",
                media_store_path="/mnt/bigdisk/media",
            )
        )
        self.assertIs(live["report_stats"], True)
        self.assertEqual(live["pid_file"], "/srv/hub/homeserver.pid")
        self.assertEqual(live["media_store_path"], "/mnt/bigdisk/media")


class RateLimitTest(unittest.TestCase):
    """Synapse's rate limit defaults are too tight for how PubHubs is used, but a hub
    owner who wants other values can still set the key themselves."""

    def test_pubhubs_values_are_injected(self):
        live = generate(base_config())
        self.assertEqual(live["rc_message"], {"per_second": 0.5, "burst_count": 15})
        self.assertEqual(live["rc_room_creation"], {"per_second": 0.1, "burst_count": 15})
        self.assertEqual(live["rc_joins"], {"local": {"per_second": 0.2, "burst_count": 15}})
        self.assertEqual(live["rc_invites"], {"per_user": {"per_second": 0.05, "burst_count": 15}})
        self.assertEqual(
            live["rc_login"],
            {
                "address": {"per_second": 1, "burst_count": 200},
                "account": {"per_second": 0.5, "burst_count": 20},
            },
        )

    def test_failed_attempts_is_left_at_the_synapse_default(self):
        """It only throttles failed password and UIA attempts, which PubHubs' OIDC login
        never triggers, so raising it would only weaken brute-force protection."""
        self.assertNotIn("failed_attempts", generate(base_config())["rc_login"])

    def test_owner_values_are_preserved(self):
        live = generate(base_config(rc_message={"per_second": 5, "burst_count": 99}))
        self.assertEqual(live["rc_message"], {"per_second": 5, "burst_count": 99})

    def test_owner_value_for_one_limit_does_not_affect_the_others(self):
        live = generate(base_config(rc_message={"per_second": 5, "burst_count": 99}))
        self.assertEqual(live["rc_joins"], {"local": {"per_second": 0.2, "burst_count": 15}})


class DoChangeConfigTest(unittest.TestCase):
    """Values an owner must change for production and must leave alone for development."""

    def test_development_accepts_the_defaults(self):
        live = generate(base_config())
        self.assertEqual(live["server_name"], "testhub.matrix.host")

    def test_development_rejects_changed_values(self):
        for key, value in (
            ("server_name", "hub.example.org"),
            ("macaroon_secret_key", "a-real-generated-secret"),
            ("public_baseurl", "https://hub.example.org"),
        ):
            with self.subTest(key=key):
                with self.assertRaises(ConfigError):
                    generate(base_config(**{key: value}))

    def test_production_accepts_changed_values(self):
        live = generate(production_config(), environment="production")
        self.assertEqual(live["server_name"], "hub.example.org")

    def test_production_rejects_unchanged_values(self):
        for key, value in (
            ("server_name", "testhub.matrix.host"),
            ("macaroon_secret_key", "macaroon_key"),
            ("public_baseurl", "http://hub.example.org"),
        ):
            with self.subTest(key=key):
                with self.assertRaises(ConfigError):
                    generate(production_config(**{key: value}), environment="production")

    def test_empty_environment_is_treated_as_production(self):
        """run() maps "" to production; UpdateConfig itself takes the resolved name."""
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "homeserver.yaml")
            out = os.path.join(tmp, "homeserver.live.yaml")
            with open(src, "w") as f:
                yaml.safe_dump(base_config(), f, sort_keys=False)
            # base_config leaves the DO_CHANGE values unchanged, which production rejects
            with self.assertRaises(ConfigError):
                update_config.run(src, out, "", global_client_url=GLOBAL_CLIENT_URL)

    def test_invalid_environment_is_rejected(self):
        with self.assertRaises(ValueError):
            generate(base_config(), environment="staging")

    def test_server_name_argument_overrides_the_config(self):
        live = generate(production_config(), environment="production", server_name="other.example.org")
        self.assertEqual(live["server_name"], "other.example.org")

    def test_hub_server_url_argument_overrides_public_baseurl(self):
        live = generate(
            production_config(), environment="production", hub_server_url="https://other.example.org"
        )
        self.assertEqual(live["public_baseurl"], "https://other.example.org")


class SsoClientWhitelistTest(unittest.TestCase):
    """Synapse matches the redirect url against the whitelist with str.startswith, so an
    entry acts as a url prefix. The global client must be on it, or logging in shows a
    confirmation page instead of redirecting straight back."""

    def test_injected_with_both_pubhubs_and_the_global_client(self):
        self.assertEqual(
            generate(base_config())["sso"]["client_whitelist"],
            ["https://app.pubhubs.net", GLOBAL_CLIENT_URL + "/"],
        )

    def test_owner_entries_are_kept(self):
        live = generate(base_config(sso={"client_whitelist": ["https://mine.example"]}))
        self.assertEqual(
            live["sso"]["client_whitelist"], ["https://mine.example", GLOBAL_CLIENT_URL + "/"]
        )

    def test_global_client_is_not_added_twice(self):
        live = generate(base_config(sso={"client_whitelist": [GLOBAL_CLIENT_URL + "/"]}))
        self.assertEqual(live["sso"]["client_whitelist"], [GLOBAL_CLIENT_URL + "/"])

    def test_empty_whitelist_is_filled(self):
        live = generate(base_config(sso={"client_whitelist": []}))
        self.assertEqual(live["sso"]["client_whitelist"], [GLOBAL_CLIENT_URL + "/"])

    def test_non_dict_is_replaced(self):
        live = generate(base_config(sso="nonsense"))
        self.assertEqual(live["sso"]["client_whitelist"], [GLOBAL_CLIENT_URL + "/"])

    def test_works_when_sso_precedes_modules_in_the_owners_file(self):
        """The global client url is resolved while handling `modules`, so a naive
        implementation breaks on hubs that happen to list `sso` first."""
        config = {"sso": {"client_whitelist": ["https://mine.example"]}}
        config.update(base_config())
        live = generate(config)
        self.assertIn(GLOBAL_CLIENT_URL + "/", live["sso"]["client_whitelist"])


class ModulesTest(unittest.TestCase):
    def test_mandatory_modules_are_added(self):
        live = generate(base_config())
        for name in (
            "conf.modules.pubhubs.Core",
            "conf.modules.pubhubs.DBMigration",
            "conf.modules.pseudonyms.Pseudonym",
            "conf.modules.pubhubs.HubClientApi",
        ):
            with self.subTest(module=name):
                self.assertIsNotNone(module_named(live, name))

    def test_mandatory_modules_are_not_duplicated(self):
        config = base_config()
        config["modules"].append({"module": "conf.modules.pubhubs.DBMigration"})
        live = generate(config)
        names = [m["module"] for m in live["modules"]]
        self.assertEqual(len(names), len(set(names)))

    def test_retired_modules_are_removed(self):
        config = base_config()
        config["modules"].append({"module": "conf.modules.config_checker.ConfigChecker"})
        config["modules"].append({"module": "conf.modules.pubhubs.ConsentResource"})
        live = generate(config)
        self.assertIsNone(module_named(live, "conf.modules.config_checker.ConfigChecker"))
        self.assertIsNone(module_named(live, "conf.modules.pubhubs.ConsentResource"))

    def test_missing_modules_section_is_rejected(self):
        config = base_config()
        del config["modules"]
        with self.assertRaises(ConfigError):
            generate(config)

    def test_modules_must_be_a_list(self):
        with self.assertRaises(ConfigError):
            generate(base_config(modules={"module": "conf.modules.pubhubs.HubClientApi"}))

    def test_missing_hub_client_api_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(modules=[{"module": "conf.modules.pubhubs.DBMigration"}]))

    def test_missing_client_url_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(
                base_config(modules=[{"module": "conf.modules.pubhubs.HubClientApi", "config": {}}])
            )

    def test_client_url_is_copied_to_the_core_module(self):
        core = module_named(generate(base_config()), "conf.modules.pubhubs.Core")
        self.assertEqual(core["config"]["hub_client_url"], HUB_CLIENT_URL)

    def test_core_module_points_at_the_local_phc_in_development(self):
        core = module_named(generate(base_config()), "conf.modules.pubhubs.Core")
        self.assertEqual(core["config"]["phc_url"], "http://host.docker.internal:5050")

    def test_core_module_points_at_the_public_phc_in_production(self):
        core = module_named(
            generate(production_config(), environment="production"), "conf.modules.pubhubs.Core"
        )
        self.assertEqual(core["config"]["phc_url"], "https://phc.pubhubs.net")

    def test_production_defaults_the_global_client_url(self):
        config = production_config()
        del config["modules"][0]["config"]["global_client_url"]
        live = generate(config, environment="production")
        api = module_named(live, "conf.modules.pubhubs.HubClientApi")
        self.assertEqual(api["config"]["global_client_url"], "https://app.pubhubs.net")

    def test_hub_client_url_argument_overrides_the_config(self):
        live = generate(base_config(), hub_client_url="http://localhost:9999")
        api = module_named(live, "conf.modules.pubhubs.HubClientApi")
        self.assertEqual(api["config"]["client_url"], "http://localhost:9999")


class OidcProvidersTest(unittest.TestCase):
    """Every field of the provider is dictated by PubHubs, so there is nothing for a hub
    owner to fill in."""

    def test_injected_as_a_single_provider_list(self):
        providers = generate(base_config())["oidc_providers"]
        self.assertIsInstance(providers, list)
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0]["idp_id"], "pubhubs")
        self.assertEqual(providers[0]["idp_name"], "PubHubs ID provider")
        self.assertIs(providers[0]["discover"], False)

    def test_existing_provider_is_completed(self):
        live = generate(base_config(oidc_providers=[{"client_id": "not used but must be set"}]))
        self.assertEqual(live["oidc_providers"][0]["idp_id"], "pubhubs")

    def test_injected_and_existing_providers_agree(self):
        with_section = generate(base_config(oidc_providers=[{"client_id": "whatever"}]))
        without_section = generate(base_config())
        self.assertEqual(with_section["oidc_providers"], without_section["oidc_providers"])

    def test_retired_user_mapping_provider_is_removed(self):
        live = generate(
            base_config(oidc_providers=[{"client_id": "x", "user_mapping_provider": {"module": "old"}}])
        )
        self.assertNotIn("user_mapping_provider", live["oidc_providers"][0])

    def test_more_than_one_provider_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(oidc_providers=[{"client_id": "a"}, {"client_id": "b"}]))

    def test_empty_provider_list_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(oidc_providers=[]))


class RetiredSettingsTest(unittest.TestCase):
    """Settings PubHubs used in the past and that must be dropped."""

    def test_form_secret_is_removed(self):
        self.assertNotIn("form_secret", generate(base_config(form_secret="secret")))

    def test_user_consent_is_removed(self):
        self.assertNotIn("user_consent", generate(base_config(user_consent={"version": "1.0"})))

    def test_consent_resource_is_removed_from_listeners(self):
        listeners = [
            {"port": 8008, "resources": [{"names": ["client", "consent"], "compress": False}]}
        ]
        live = generate(base_config(listeners=listeners))
        self.assertEqual(live["listeners"][0]["resources"][0]["names"], ["client"])

    def test_listeners_without_consent_are_untouched(self):
        listeners = [{"port": 8008, "resources": [{"names": ["client"], "compress": False}]}]
        live = generate(base_config(listeners=listeners))
        self.assertEqual(live["listeners"], listeners)


class DatabaseTest(unittest.TestCase):
    def test_sqlite3_path_is_found(self):
        config = {"database": {"name": "sqlite3", "args": {"database": "/data/homeserver.db"}}}
        self.assertEqual(sqlite3_path_in(config), "/data/homeserver.db")

    def test_sqlite3_path_is_none_for_other_engines(self):
        self.assertIsNone(sqlite3_path_in({"database": {"name": "psycopg2", "args": {}}}))
        self.assertIsNone(sqlite3_path_in({}))

    def test_sqlite3_is_replaced_by_postgres(self):
        config = base_config(
            database={"name": "sqlite3", "args": {"database": "/data/homeserver.db", "cp_min": 5}}
        )
        live = generate(config, replace_sqlite3_by_postgres=True)
        self.assertEqual(live["database"]["name"], "psycopg2")
        self.assertEqual(live["database"]["args"]["dbname"], "hub")
        self.assertEqual(live["database"]["args"]["host"], "/var/run/postgresql")
        self.assertNotIn("database", live["database"]["args"])

    def test_connection_pool_settings_survive_the_replacement(self):
        config = base_config(
            database={"name": "sqlite3", "args": {"database": "/data/homeserver.db", "cp_min": 5}}
        )
        live = generate(config, replace_sqlite3_by_postgres=True)
        self.assertEqual(live["database"]["args"]["cp_min"], 5)

    def test_an_existing_postgres_config_is_left_alone(self):
        database = {"name": "psycopg2", "args": {"dbname": "mine", "host": "db.example.org"}}
        live = generate(base_config(database=database), replace_sqlite3_by_postgres=True)
        self.assertEqual(live["database"], database)

    def test_sqlite3_without_a_path_is_rejected(self):
        with self.assertRaises(ConfigError):
            generate(base_config(database={"name": "sqlite3", "args": {}}),
                     replace_sqlite3_by_postgres=True)


class IsolationTest(unittest.TestCase):
    """update_config must not carry state between runs. start_hub.py happens to call it
    once per process, which is the only reason a leak would not already be visible."""

    def test_generating_twice_gives_the_same_result(self):
        first = generate(base_config())
        second = generate(base_config())
        self.assertEqual(first, second)

    def test_a_hub_that_lists_the_mandatory_modules_does_not_affect_the_next_hub(self):
        listing_hub = base_config()
        listing_hub["modules"] += [
            {"module": "conf.modules.pubhubs.Core", "config": {"phc_url": "http://x"}},
            {"module": "conf.modules.pubhubs.DBMigration"},
            {"module": "conf.modules.pseudonyms.Pseudonym"},
        ]
        generate(listing_hub)

        live = generate(base_config())
        for name in (
            "conf.modules.pubhubs.Core",
            "conf.modules.pubhubs.DBMigration",
            "conf.modules.pseudonyms.Pseudonym",
        ):
            with self.subTest(module=name):
                self.assertIsNotNone(module_named(live, name))

    def test_class_level_config_is_not_mutated(self):
        before = {
            "modules": set(UpdateConfig.DONT_CHANGE_CONFIG["modules"]),
            "sso": {"client_whitelist": list(UpdateConfig.DONT_CHANGE_CONFIG["sso"]["client_whitelist"])},
        }
        listing_hub = base_config()
        listing_hub["modules"] += [{"module": "conf.modules.pubhubs.Core", "config": {}}]
        generate(listing_hub)

        self.assertEqual(UpdateConfig.DONT_CHANGE_CONFIG["modules"], before["modules"])
        self.assertEqual(UpdateConfig.DONT_CHANGE_CONFIG["sso"], before["sso"])

    def test_the_owners_config_is_not_modified_in_place(self):
        config = base_config()
        snapshot = yaml.safe_dump(config, sort_keys=True)
        generate(config)
        self.assertEqual(yaml.safe_dump(config, sort_keys=True), snapshot)


class ErrorReportingTest(unittest.TestCase):
    """A hub owner reads these messages in the boot log, so a misconfiguration must be a
    ConfigError rather than a bare Exception that reads like a crash."""

    def test_missing_modules_raises_config_error(self):
        config = base_config()
        del config["modules"]
        with self.assertRaises(ConfigError):
            generate(config)

    def test_a_rejected_value_raises_config_error(self):
        with self.assertRaises(ConfigError):
            generate(base_config(enable_registration=True))

    def test_the_offending_key_is_named_in_the_message(self):
        with self.assertRaises(ConfigError) as caught:
            generate(base_config(enable_registration=True))
        self.assertIn("enable_registration", str(caught.exception))


class ShippedTemplateTest(unittest.TestCase):
    """The template doubles as the development testhub config and as the example for hub
    owners, so it must survive its own checks."""

    TEMPLATE = os.path.join("matrix_test_config", "homeserver.yaml")

    def test_template_produces_a_valid_live_config(self):
        with open(self.TEMPLATE) as f:
            config = yaml.safe_load(f)
        live = generate(config)
        self.assertEqual(live["server_name"], "testhub.matrix.host")
        self.assertIsNotNone(module_named(live, "conf.modules.pubhubs.Core"))
        self.assertIn("https://app.pubhubs.net", live["sso"]["client_whitelist"])

    def test_template_carries_no_settings_update_config_already_supplies(self):
        """Anything update_config injects should not be duplicated in the template, or the
        two drift apart."""
        with open(self.TEMPLATE) as f:
            config = yaml.safe_load(f)
        supplied = set(UpdateConfig.DONT_CHANGE_CONFIG) | set(UpdateConfig.DEFAULT_CONFIG)
        # modules is the one setting an owner must provide, since it carries client_url.
        self.assertEqual(supplied & set(config), {"modules"})


if __name__ == "__main__":
    unittest.main()
