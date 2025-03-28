#!/usr/bin/env python3
# You can run this script locally in the docker container with 
# ./conf/update_config/update_config.py  --in 'data/homeserver.yaml' --out "$SYNAPSE_CONFIG_PATH" --environment="$UPDATE_CONFIG_ENV"
# SYNAPSE_CONFIG_PATH is where the generated file will be stored and also the yaml file that synaps will use to run
# The --environment can be either "development" or "production"
import yaml
from enum import Enum
from typing import Any
import argparse
import pathlib
import contextlib
from textwrap import dedent
from synapse.module_api.errors import ConfigError
import logging

logging.basicConfig(
    format='%(message)s',
    level=logging.INFO
)

logger = logging.getLogger()

class CheckEnvironment(Enum):
    DEVELOPMENT = "dont change"
    PRODUCTION = "change"


class UpdateConfig:
    """
    This class takes a hub homeserver.yaml file and checks for malconfigurations and adds missing yaml settings that pubhubs needs to function properly.
    After it is done updating and checking the homserver.yaml it generates the updated version as homeserver.live.yaml
    
    All the updates and checks can be found in two main methods in this class

    Important Methods
    -----------------
    _update_and_check_dont_change_config: This method checks all values that should not changed and adds them if they are missing or raises an error if they are the wrong value using the DONT_CHANGE_CONFIG dict

    _check_did_change_config: This method checks all values that should be changed for production and raises an error if they are not with the DO_CHANGE_CONFIG dict
    In the development this method checks that the values are not changed from the default settings which work for development

    """
    # (DONT_)CHANGE_CONFIG contain configuration used by the checks below
    #
    # WARNING: The structure of (DONT_)CHANGE_CONFIG is similar, but not exactly the same as 
    #          the structure of homeserver.yaml. 
    # Some structures were simplified to not make some of the checks more complex than they need to be
    DONT_CHANGE_CONFIG = {
        "modules": {
            "conf.modules.pubhubs.Core",
            "conf.modules.pubhubs.DBMigration",
            "conf.modules.pseudonyms.Pseudonym",
        },
        "oidc_providers": {
            "idp_id": "pubhubs",
            "idp_name": "PubHubs ID provider",
            "discover": True,
            "scopes": ["openid"],
            "skip_verification": False,
            "user_mapping_provider": {
                "module": "conf.modules.pseudonyms.OidcMappingProvider",
                "config": {"libpubhubspath": "/usr/lib/libpubhubs.so"},
            },
        },
        "federation_domain_whitelist": [],
        "allow_profile_lookup_over_federation": False,
        "allow_per_room_profiles": False,
        "enable_registration": False,
        "server_notices": {"system_mxid_localpart": ["notices_user", "notices"]},
        "password_config": {"enabled": False},
        "enable_authenticated_media":True,
        "trusted_key_servers": [],
        "update_profile_information":True,
        "room_list_publication_rules": [{"action": "allow"}],
        "sso": {"client_whitelist": ["https://app.pubhubs.net"]},
    }
    # The modules key is of a different python structure than the modules key in the loaded yaml file
    DO_CHANGE_CONFIG = {
        "macaroon_secret_key": "macaroon_key",
        "form_secret": "form_secret",
        "server_name": "testhub.matrix.host",
        "public_baseurl": "http://localhost:8008",      
    }
    EXAMPLE_CONFIG = {
        "modules": {
            "module": "conf.modules.pubhubs.HubClientApi",
            "config": {
                "client_url": "http://localhost:8800",
            },
        },
        "oidc_providers": {
            "client_id": "testhub~TwE1w3BX-RrDRe7FFqkbRlkp4FiBh4cgtRwtrpmv7Gc=",
            "client_secret": "p7v7c_L_Eo0Clkx-fBvbGddHPkTEbR59oueM6XaKVYI=",
        },
    }

    def __init__(self, config_env: str):
        match config_env:
            case "production":
                self.check_environment = CheckEnvironment.PRODUCTION
            case "development":
                self.check_environment = CheckEnvironment.DEVELOPMENT
            case _:
                raise ValueError(f"❌  {config_env} is not a valid config environment init parameter for the UpdateConfig class")

        

    def load_and_update_config(
        self, homeserver_file_path:str
    ) -> dict:
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

        homeserver_live = self._update_and_check_dont_change_config(homeserver)

        homeserver_live = self._check_did_change_config(homeserver_live)

        return homeserver_live

    def _update_and_check_dont_change_config(self, homeserver: dict) -> dict:
        """
        Check that all dont_change config values have the correct values and are present.
        If the don't change config is completely missing add it.
        If the dont change config has the wrong value raise a config error.
        Return the updated homeserver_live dictionary
        """
        to_be_checked_config = self.DONT_CHANGE_CONFIG.copy()
        check_type_log_info = "dont change"
        homeserver_live = homeserver.copy()
        # Make sure the don't change values have not been changed and are present in the homeserver.live.yaml
        for key, value in homeserver.items():
            match key:
                case "modules":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_and_update_modules(key, value, homeserver_live)
                        global_client_url = self._check_did_HubClientApi_change(key, homeserver_live)
                case "oidc_providers":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_and_update_oidc(key, value, homeserver_live)
                        self._check_did_issuer_or_client_id_change(key, value, homeserver_live)
                case "sso":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        if global_client_url[-1] != "/":
                            global_client_url += "/"
                        if not isinstance(value, dict):
                            homeserver_live[key] = ({"client_whitelist": [global_client_url]})
                        elif not "client_whitelist" in value or not value["client_whitelist"]:
                            homeserver_live[key]["client_whitelist"] = [global_client_url]
                        elif not global_client_url in value["client_whitelist"]:
                            homeserver_live[key]["client_whitelist"] += [global_client_url]
                case "federation_domain_whitelist":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "allow_profile_lookup_over_federation":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "allow_per_room_profiles":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "enable_registration":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "server_notices":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        if not isinstance(value, dict):
                             homeserver_live[key] = {"system_mxid_localpart": self.DONT_CHANGE_CONFIG[key]['system_mxid_localpart'][0]}
                        elif "system_mxid_localpart" in value:
                            self._check_notices_did_not_change(key, value["system_mxid_localpart"], self.DONT_CHANGE_CONFIG[key]["system_mxid_localpart"])
                        else:
                            homeserver_live[key].update({"system_mxid_localpart": self.DONT_CHANGE_CONFIG[key]['system_mxid_localpart'][0]})
                case "password_config":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        if not isinstance(value, dict):
                            homeserver_live[key] = {"enabled": self.DONT_CHANGE_CONFIG[key]['enabled']}
                        elif "enabled" in value:
                            self._check_did_password_enabled_not_change(key, value["enabled"], self.DONT_CHANGE_CONFIG[key]["enabled"])
                        else:
                            homeserver_live[key].update({"enabled": self.DONT_CHANGE_CONFIG[key]['enabled']})
                case "enable_authenticated_media":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        if value != self.DONT_CHANGE_CONFIG[key]:
                            homeserver_live[key] = self.DONT_CHANGE_CONFIG[key]
                            logger.warning(f" - Warning ⚠️  {key} was {value} which is incorrect, so the value was overwritten with the default pubhubs value to {self.DONT_CHANGE_CONFIG[key]}")
                case "trusted_key_servers":
                    with self._try_check(key, to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "update_profile_information":
                    with self._try_check(key,  to_be_checked_config, check_type_log_info):
                        self._check_did_not_change(key, value, self.DONT_CHANGE_CONFIG[key])
                case "room_list_publication_rules":
                    with self._try_check(key,  to_be_checked_config, check_type_log_info):
                        if not isinstance(value, list):
                            homeserver_live[key] = self.DONT_CHANGE_CONFIG[key]
                        elif "action" in value[0]:
                            self._check_did_not_change(f"{key}.action", value[0]['action'], self.DONT_CHANGE_CONFIG[key][0]['action'])
                        else:
                            homeserver_live[key][0].update(self.DONT_CHANGE_CONFIG[key][0])
        # Update settings that pubhubs needs to work that are missing
        for key, value in to_be_checked_config.items():
            try:
                match key:
                    case "modules":
                        raise ConfigError(
                        f"❌  {key} setting should be present in homeserver.yaml but is missing, example: modules: {self.EXAMPLE_CONFIG['modules']}"
                    )
                    case "oidc_providers":
                        raise ConfigError(
                        f"❌  {key} setting should be present in homeserver.yaml but is missing, example: oidc_providers: {self.EXAMPLE_CONFIG['oidc_providers']}"
                    )
                    case "server_notices":
                        homeserver_live[key] = {"system_mxid_localpart": value['system_mxid_localpart'][0]}
                    case _:
                        assert (key not in homeserver_live), "❌  They key that is being overwritten is already in homeserver_live, the check for this key is missing or not executed properly"
                        homeserver_live[key] = value
                logger.info(f" - INFO ✅  added pubhubs setting for {key} in configuration  with value: {homeserver_live[key]} to new yaml file")
            except Exception as e:
                raise Exception(f"❌   Failed to update {key} to value {to_be_checked_config[key]}: {e}") from e

        return homeserver_live

    def _check_did_change_config(self, homeserver_live: dict) -> None:
        """
        Check that all config that is supposed to be changed for production is changed.
        Raise an error if the config is not changed.
        If this class is in the development environment make sure the config is not changed.
        Raise an error if the config is changed.
        If the checkOperation is set to ignore do not do any checks
        """
        check_type_log_info = self.check_environment.value
        to_be_checked_config = self.DO_CHANGE_CONFIG.copy()
        # check that do change values are indeed changed
        for key, value in homeserver_live.items():
            match key:
                case "macaroon_secret_key":
                    with self._try_check(key, to_be_checked_config,check_type_log_info):
                        self._check_did_change(key, value, self.DO_CHANGE_CONFIG[key])
                case "form_secret":
                    with self._try_check(key, to_be_checked_config,check_type_log_info):
                        self._check_did_change(key, value, self.DO_CHANGE_CONFIG[key])
                case "server_name":
                    with self._try_check(key, to_be_checked_config,check_type_log_info):
                        self._check_did_change(key, value, self.DO_CHANGE_CONFIG[key])
                case "public_baseurl":
                    with self._try_check(key, to_be_checked_config,check_type_log_info):
                        self._check_did_start_change(key, value, "http://localhost")
        if to_be_checked_config:
            raise ConfigError(
                f"❌   These values that are supposed to be set for the config are missing: {to_be_checked_config}"
            )
        return homeserver_live

    @contextlib.contextmanager
    def _try_check(self, key:str, to_be_checked_config:dict, check_type_log_info:str):
        """
        Contextmanager for all check methods in this class
        It will remove keys that have been checked from the dictonary
        It will raise configerrors from the methods unchanged and
        raise a general exception with info if an unexpected error is raised
        It also logs are checks that have been completed succesfully
        """
        try:
            yield
            to_be_checked_config.pop(key)
            logger.info(f" - INFO ✅  {check_type_log_info} check succeeded for {key} in yaml file")
        except ConfigError:
            raise
        except Exception as e:
            raise Exception(f"❌   Configuration check failed for {key}: {e}") from e

    def _check_did_not_change(
        self, key: str, value: Any, default: bool | list
    ) -> None:
        if value != default:
            raise ConfigError(f"❌   {key} should have the value {default} but is {value}")

    def _check_notices_did_not_change(
        self, key: str, server_notice: str, admissible_notice: list[str]
    ) -> None:
        """
        Check that server_notice:system_mxid_localpart is one of two admissable values.

        After checking synaps documentation it seems to me any value for system_mxid_localpart is valid for our implementation.
        """
        if server_notice not in admissible_notice:
            raise ConfigError(
                f"❌   {key}.system_mxid_localpart should have one of the values {admissible_notice} but is {server_notice}"
            )
    def _check_did_password_enabled_not_change(
        self, key: str, value: Any, default: bool
    ) -> None:
        if value != default:
            raise ConfigError(f"❌   {key}.enabled should have the value {default} but is {value}")

    def _check_and_update_modules(
        self, key: str, value: Any, homeserver_live: dict
    ) -> None:
        """
        Add missing pubhubs modules that are never changed to homeserver_live.
        HubClientAPI is checked elsewhere because that module has a config
        that has to be changed.
        """
        if not isinstance(value, list):
            raise ConfigError(f"❌  Expected a list for the {key} value, but got {value} instead")
        # This script replaces the configchecker, so remove the module key from old yaml configurations
        value = list([mod for mod in value if mod['module'] != 'conf.modules.config_checker.ConfigChecker'])
        mandatory_modules = self.DONT_CHANGE_CONFIG["modules"]
        for module in value.copy():
            # Remove present modules from mandatory modules checklist
            if module["module"] in mandatory_modules:
                mandatory_modules.remove(module["module"])
        # Add modules that are missing to tmp value
        for module_name in mandatory_modules:
            value.append({"module": module_name})
        # Update config dict
        homeserver_live[key] = value

    def _check_and_update_oidc(
        self, key: str, value: Any, homeserver_live: dict
    ) -> None:
        """
        Ensures exactly one provider exists and has the correct configuration.

        If the above checks pass validate the OIDC provider settings against mandatory values
        and update the new yaml file with any missing mandatory settings.
        
        """
        if not isinstance(value, list) or not value:
            raise ConfigError(f"❌  Expected a non empty list for the {key} value, but got {value} instead")

        # Verify we have exactly one provider
        if len(value) != 1:
            raise ConfigError(
                f"❌   {key} should have exactly 1 provider but has {len(value)} providers: {value}"
            )
        mandatory_oidc = self.DONT_CHANGE_CONFIG["oidc_providers"]

        provider = homeserver_live[key][0]

        if not isinstance(provider, dict) :
            raise ConfigError(f"❌  Expected a dict for the {key} list item value, but got {provider} instead")

        # Check that existing settings have the correct values
        for oidc_key, expected_value in mandatory_oidc.copy().items():
            if oidc_key not in provider:
                continue
            actual_value = provider[oidc_key]
            if actual_value != expected_value:
                raise ConfigError(
                    f"❌   {key}.{oidc_key} has incorrect value: expected {expected_value}, but got {actual_value}"
                )
            # Remove checked settings from the mandatory list
            mandatory_oidc.pop(oidc_key)

        # Add any missing mandatory settings to the provider configuration
        provider.update(mandatory_oidc)

    def _check_did_change(
        self, key: str, value: Any, default: str
    ):
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

    def _check_did_start_change(
        self, key: str, value: Any, default: str
    ):
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

    def _check_did_HubClientApi_change(
        self, key: str, homeserver_live:dict
    ) -> str:
        """
        Check the module configurations

        If client_url or global_client_url are not present raise a ConfigError

        If they are present check if the start of the string is changed with _check_did_start_change
        """
        modules = homeserver_live[key].copy()
        for index, module_dict in enumerate(modules):
            if not (
                "config" in module_dict
                and "module" in module_dict
                and module_dict["module"] == "conf.modules.pubhubs.HubClientApi"
            ):
                continue
            config = module_dict["config"]
            if "client_url" in config:
                self._check_did_start_change(
                    f"({module_dict['module']}'s config).client_url",
                    config["client_url"],
                    "http://localhost"
                )
            else:
                raise ConfigError("❌   config.client_url should be set but is missing")
            if "global_client_url" in config:
                self._check_did_start_change(
                    f"({module_dict['module']}'s config).global_client_url",
                    config["global_client_url"],
                    "http://localhost"
                )
            else:
                if self.check_environment == CheckEnvironment.DEVELOPMENT:
                    homeserver_live[key][index]["config"]["global_client_url"] = "http://localhost:8080"
                else:
                    homeserver_live[key][index]["config"]["global_client_url"] = "https://app.pubhubs.net"

            global_client_url = homeserver_live[key][index]["config"]["global_client_url"]

            break
        else:
            raise ConfigError(
                "❌   conf.modules.pubhubs.HubClientApi and config should be present in a module but are missing"
            )
        return global_client_url

    def _check_did_issuer_or_client_id_change(
        self, key: str, oidc_settings: Any, homeserver_live:dict
    ) -> None:
        """
        If either the issuer or client_id value are not present raise a configerror

        If the values are present check if the value is changed with _check_did_change
        """
        if "issuer" in oidc_settings[0]:
            self._check_did_change(
                f"{key}.issuer",
                oidc_settings[0]["issuer"],
                "http://host.docker.internal:8080"
            )
        else:
            if self.check_environment == CheckEnvironment.DEVELOPMENT:
                homeserver_live[key][0]['issuer'] = "http://host.docker.internal:8080"
            else:
                homeserver_live[key][0]['issuer'] = "https://app.pubhubs.net"
        if "client_id" in oidc_settings[0]:
            self._check_did_start_change(
                f"{key}.client_id", oidc_settings[0]["client_id"], "testhub"
            )
        else:
            raise ConfigError(f"❌   {key}.client_id expected to be set but is missing")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Update Synapse configuration.')
    parser.add_argument('--in', dest='input_file', required=True, 
                       help='Input configuration file path')
    parser.add_argument('--out', dest='output_file', required=True, 
                       help='Output configuration file path')
    parser.add_argument('--environment', required=True, choices=["", "production", "development"],
                       help='Determines what configuration changes are expected. ("" is interpreted as production.)')

    
    args = parser.parse_args()
    
    homeserver_file_path = args.input_file
    homeserver_live_file_path = args.output_file
    config_env = args.environment if args.environment!="" else 'production'

    # Update config homeserver, output as homeserver.live
    update_config_module = UpdateConfig(config_env)
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
            yaml.dump(homeserver_live, f)
    except IOError as e:
        raise IOError(f"❌  Could not write homeserver.live.yaml to {homeserver_live_file_path}: {e}") from e
    except yaml.YAMLError as e:
            raise yaml.YAMLError(f"❌  Error while saving homeserver.live dict to YAML: {e}") from e

    logger.info(f" - INFO ✅  Generated updated configuration of homeserver.yaml at {homeserver_live_file_path}")
