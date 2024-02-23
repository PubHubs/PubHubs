# The purpose of this module is to check the homeserver.yaml configuration.
#
# Since modules shouldn't have access to homeserver.yaml the configuration-checking code
# is somewhat fragile in the sense that updates to Synapse might break the checking code.
#
# This is why we only throw an exception when we're sure there's a configuration problem.
# Otherwise we simply print an error to the log, and let Synapse proceed.
#
import logging

from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError

import conf.modules.pubhubs
import conf.modules.pseudonyms

logger = logging.getLogger(__name__)


class ConfigChecker:

    def __init__(self, cc_config: dict, api: ModuleApi):
        self.api = api
        self.cc_config = cc_config

        try:
            self.config = api._hs.config
        except:
            logger.error("failed to obtain Synapse configuration from module")
            return

        for reqm in [
                conf.modules.pseudonyms.Pseudonym,
                conf.modules.pubhubs.ConfigChecker, # for completeness sake
                conf.modules.pubhubs.YiviRoomJoiner,
                conf.modules.pubhubs.DBMigration]:
            self.try_check(self.check_module_present, f"the {reqm.__name__} module is present", reqm)

        self.try_check(self.check_password_login_disabled, "password login is disabled")

        self.try_check(self.check_federation_is_disabled, "federation is disabled")

        self.try_check(self.check_per_room_profiles_are_disabled, "per room profiles are disabled")

        if api.public_baseurl.startswith("https") and not self.cc_config.get("disable_default_secrets_check", False):
            logger.info("public_baseurl starts with 'https', so we assume this is a production environment\n"
                        "  NOTE: you can disable this check by setting 'disable_default_secrets_check' to false in 'homeserver.yaml' ")
            self.try_check(self.check_default_secrets_are_changed, "default secrets are not used")

        self.try_check(self.check_no_profile_lookups_over_federation, "profile lookups over federation are disabled")
        # block_non_admin_invites? #566


    def try_check(self, f, what, *args, **kwargs):
        # re-raises only a ConfigError
        try:
            f(*args, **kwargs)
        except ConfigError:
            raise
        except Exception as e:
            logger.error(f"failed to check {what}: {e}")
            return
        logger.info(f"checked that {what}")

    def check_module_present(self, module):
        modules_present = set(map(lambda module_details: module_details[0], self.config.modules.loaded_modules))
        if module not in modules_present:
            raise ConfigError(f"Missing module {module}; please add '- module: {module}' to the 'modules:' list in 'homeserver.yaml'")

    def check_password_login_disabled(self):
        if self.config.auth.password_enabled_for_login or self.config.auth.password_enabled_for_reauth: 
            raise ConfigError(f"Password login enabled; please disable it by setting 'enabled: false' under 'password_config:' in 'homeserver.yaml'")

    def check_federation_is_disabled(self):
        if self.config.federation.federation_domain_whitelist != {}:
            raise ConfigError(f"Federation must be disabled by setting 'federation_domain_whitelist: []' in 'homeserver.yaml' - the current federation whitelist is: {self.config.federation.federation_domain_whitelist}")

    def check_per_room_profiles_are_disabled(self):
        if self.config.server.allow_per_room_profiles:
            raise ConfigError("Please set 'allow_per_room_profiles: false' in 'homeserver.yaml'")

    def check_default_secrets_are_changed(self):
        for key in self.config.key.signing_key:
            logger.info(bytes(key))
            if bytes(key) == b'\xee\xe9@\x8c\xd2R\x7ft\x15\x1e\x03#\xc8\xf3[\xb9\x89\x95\x9b\x80\xe6\x06\xbd\n\xb7~"5\x91%v\xac':
                raise ConfigError("Please do not use the default 'testhub.signing.key'")
                

        if self.config.key.macaroon_secret_key == b"macaroon_key":
            raise ConfigError("Please change 'macaroon_secret_key' in 'homeserver.yaml' from the default")
        if self.config.key.form_secret == "form_secret":
            raise ConfigError("Please change 'form_secret' in 'homeserver.yaml' from the default")


    def check_no_profile_lookups_over_federation(self):
        if self.config.federation.allow_profile_lookup_over_federation:
            raise ConfigError("Please set 'allow_profile_lookup_over_federation: false' in 'homeserver.yaml'")

            
