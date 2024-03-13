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

from .. import pubhubs
from .. import pseudonyms

logger = logging.getLogger(__name__)


class ConfigChecker:

    def __init__(self, cc_config: dict, api: ModuleApi):
        self.api = api
        self.cc_config = cc_config
        self.errs = []
        self._modules = None # set by 'load_modules'

        try:
            self.config = api._hs.config
        except:
            logger.error("failed to obtain Synapse configuration from module")
            return

        self.try_check(self.load_modules, "loaded modules can be inspected")

        if self._modules:
            for reqm in [
                    pseudonyms.Pseudonym,
                    pubhubs.ConfigChecker, # for completeness sake
                    pubhubs.YiviRoomJoiner,
                    pubhubs.DBMigration]:
                self.try_check(self.check_module_present, f"the {reqm.__name__} module is present", reqm)

        self.try_check(self.check_password_login_disabled, "password login is disabled")

        self.try_check(self.check_federation_is_disabled, "federation is disabled")

        self.try_check(self.check_per_room_profiles_are_disabled, "per room profiles are disabled")

        self.try_check(self.check_no_profile_lookups_over_federation, "profile lookups over federation are disabled")

        self.try_check(self.check_client_is_whitelisted, "client is whitelisted")

        check_did_change = self.cc_config.get("check_did_change", None)
        
        if check_did_change == None and api.public_baseurl.startswith("https"):
            logger.info("public_baseurl starts with 'https', so we assume this is a production environment\n"
                        "  NOTE: you can disable this check by setting 'check_did_change' to false in 'homeserver.yaml' ")

        if check_did_change:
            self.try_check(self.check_signing_key_changed, "default signing key is not used")
            self.try_check(self.check_macaroon_secret_changed, "default macaroon secret is not used")
            self.try_check(self.check_form_secret_changed, "default form secret is not used")
            self.try_check(self.check_client_url_changed, "default client url is not used")

        # TODO:
        # block_non_admin_invites? #566
        # client_url
        # global_client_url
        # trusted_key_servers
        # server_name

        if self.errs:
            raise ConfigError("\n\nThere are some problems with the 'homeserver.yaml' configuration from PubHubs' perspective:\n" + 
                "\n".join([" - " + err for err in self.errs]) + "\n\n") 


    def try_check(self, f, what, *args, **kwargs):
        # re-raises only a ConfigError
        logger.info(f"checked that {what}...")
        try:
            f(*args, **kwargs)
        except ConfigError as e:
            self.errs.append(e.msg)
            return
        except Exception as e:
            logger.error(f"failed to check {what}: {e}")
            return

    def load_modules(self):
        self._modules = {}
        for module_details in self.config.modules.loaded_modules:
            self._modules[module_details[0]] = module_details[1]

    def check_module_present(self, module):
        if module not in self._modules:
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

    def check_signing_key_changed(self):
        for key in self.config.key.signing_key:
            if bytes(key) == b'\xee\xe9@\x8c\xd2R\x7ft\x15\x1e\x03#\xc8\xf3[\xb9\x89\x95\x9b\x80\xe6\x06\xbd\n\xb7~"5\x91%v\xac':
                raise ConfigError("Please do not use the default 'testhub.signing.key'")
                
    def check_macaroon_secret_changed(self):
        if self.config.key.macaroon_secret_key == b"macaroon_key":
            raise ConfigError("Please change 'macaroon_secret_key' in 'homeserver.yaml' from the default")

    def check_form_secret_changed(self):
        if self.config.key.form_secret == "form_secret":
            raise ConfigError("Please change 'form_secret' in 'homeserver.yaml' from the default")

    def check_no_profile_lookups_over_federation(self):
        if self.config.federation.allow_profile_lookup_over_federation:
            raise ConfigError("Please set 'allow_profile_lookup_over_federation: false' in 'homeserver.yaml'")

    def check_client_url_changed(self):
        client_url = self._modules[pubhubs.YiviRoomJoiner].get("client_url", None)
        if client_url == None:
            raise ConfigError("Please set 'client_url' in the configuration of the 'YiviRoomJoiner' module")
        if client_url.startswith("http://localhost"):
            raise ConfigError("Please change 'client_url' in the 'YiviRoomJoiner' module from the default")

    def check_client_is_whitelisted(self):
        client_url = self._modules[pubhubs.YiviRoomJoiner]["client_url"]
        # C.f. https://github.com/element-hq/synapse/blob/f4e12ceb1fc2a02b2c3deed4530cea0a601ec4df/synapse/handlers/auth.py#L277
        whitelist = tuple(self.config.sso.sso_client_whitelist)
        if not client_url.startswith(whitelist):
            raise ConfigError(f"Please add your client url ({client_url}) - or a prefix of it - to 'sso -> client_whitelist' ({whitelist})")
            
