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

    def __init__(self, config: dict, api: ModuleApi):
        self.api = api
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

        # TODO:
        #  look through current sample config  
        #
        # macaroon_secret_key != macaroon_key
        # form_secret != form_secret
        # block_non_admin_invites?
        # require_membership_for_aliases?
        # allow_profile_lookup_over_federation == False
        # allow_device_name_lookup_over_federation
        # allow_guest_access == False
        # signing_key_path?


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


            
