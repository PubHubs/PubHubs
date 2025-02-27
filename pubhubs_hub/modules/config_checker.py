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

from . import pubhubs
from . import pseudonyms

logger = logging.getLogger(__name__)


class ConfigChecker:

    def __init__(self, cc_config: dict, api: ModuleApi):
        self.api = api
        self.cc_config = cc_config

        # True if DO CHANGE fields should be changed;
        # False if DO CHANGE fields should be unchanged; and
        # None if DO CHANGE fields should not be checked.
        self.do_change = None

        self.errs = []
        self.modules = None # set by 'load_modules'

        try:
            self.config = api._hs.config
        except:
            logger.error("failed to obtain Synapse configuration from module")
            return

        self.try_check(self.load_modules, "loaded modules can be inspected")

        if self.modules:
            for reqm in [
                    pseudonyms.Pseudonym,
                    ConfigChecker, # for completeness sake
                    pubhubs.Core,
                    pubhubs.HubClientApi,
                    pubhubs.DBMigration]:
                self.try_check(self.check_module_present, f"the {reqm.__name__} module is present", reqm)

        self.try_check(self.check_password_login_disabled, "password login is disabled")

        self.try_check(self.check_federation_is_disabled, "federation is disabled")

        self.try_check(self.check_per_room_profiles_are_disabled, "per room profiles are disabled")

        self.try_check(self.check_no_profile_lookups_over_federation, "profile lookups over federation are disabled")

        self.try_check(self.check_client_is_whitelisted, "client is whitelisted")

        self.try_check(self.check_registration_is_disabled, "registration is disabled")

        self.try_check(self.check_server_notices_localpart, "server notices username's localpart")

        self.try_check(self.check_oidc_provider, "the oidc provider has been configured correctly")

        check_do_change_fields = self.cc_config.get("check_do_change_fields", None)

        if check_do_change_fields == None:
            if api.public_baseurl.startswith("https"):
                logger.info("since public_baseurl starts with 'https' we assume that we're dealing with a " +
                    "production environment, and will check that all DO CHANGE fields have been  changed.\n" +
                    "  DEVELOPERS: please take a look at the 'check_do_change_fields' field in 'homeserver.yaml' ")
                self.do_change = True
            else:
                logger.info("since public_baseurl doesn't start with 'https' we assume that we're dealing with a " +
                    "development environment, and will check that all DO CHANGE fields have *not* been changed. " +
                    "This forces you, the developer, to update the check in the config_checker module when you update " +
                    "the default value of a DO CHANGE field.\n\n" +
                    "  NOTE: you can temporarily disable this check by setting " +
                            "'check_do_change_fields' to 'no' in 'homeserver.yaml'")
                self.do_change = False
        else:
            DO_CHANGE_MAP = {
                   'no' : None,
                   'yes_should_be_changed': True,
                   'yes_should_be_unchanged': False,
                   }

            if check_do_change_fields in DO_CHANGE_MAP:
                self.do_change = DO_CHANGE_MAP[check_do_change_fields]
            else:
                raise ConfigError(f"'check_do_change_fields' has unexpected value {repr(check_do_change_fields)} - "
                                    + f"it should be one of {tuple(DO_CHANGE_MAP.keys())}")

        if self.do_change != None:
            self.try_check_did_change(self.signing_key_changed, "signing key (see 'signing_key_path')")
            self.try_check_did_change(self.macaroon_secret_changed, "'macaroon_secret'")
            self.try_check_did_change(self.form_secret_changed, "'form_secret'")
            self.try_check_did_change(self.client_url_changed, "'client_url' in the 'HubClientApi' module configuration")
            self.try_check_did_change(self.global_client_url_changed, "'global_client_url' in the 'HubClientApi' module configuration")
            self.try_check_did_change(self.issuer_changed, "'issuer' under 'oidc_providers'")
            self.try_check_did_change(self.client_id_changed, "'client_id' under 'oidc_providers'")
            # we cannot really tell whether client_secret has been changed from the default due to the
            # multiple testhubs that may be created under development
            self.try_check_did_change(self.server_name_changed, "'server_name'")
            self.try_check_did_change(self.public_baseurl_changed, "'public_baseurl'")

        # TODO:
        # block_non_admin_invites? #566

        if self.errs:
            raise ConfigError("\n\nThere are some problems with the 'homeserver.yaml' configuration from PubHubs' perspective:\n" +
                "\n".join([" - " + err for err in self.errs]) + "\n\n")

    def try_check(self, f, what, *args, **kwargs):
        logger.info(f"checked that {what}...")
        try:
            for err_msg in  f(*args, **kwargs):
                self.errs.append(err_msg)
        except ConfigError as e:
            self.errs.append(e.msg)
            return
        except Exception as e:
            logger.error(f"failed to check {what}: {e}")
            return

    def try_check_did_change(self, f, what, *args, **kwargs):
        self.try_check(self.check_did_change,
                       f"{what} {'did' if self.do_change else 'did not'} change", what, f, *args, **kwargs)

    def check_did_change(self, what, f, *args, **kwargs):
        did_change = f(*args, **kwargs)
        if did_change == self.do_change:
            return
        yield f"Please {'do' if self.do_change else 'do not'} change {what} from the default"

    def load_modules(self):
        self.modules = {}
        for module_details in self.config.modules.loaded_modules:
            self.modules[module_details[0]] = module_details[1]
        yield from ()

    def check_module_present(self, module):
        if module not in self.modules:
            yield f"Missing module {module.__name__}; please add '- module: {module.__module__}.{module.__name__}' to the 'modules:' list in 'homeserver.yaml'"

    def check_registration_is_disabled(self):
        if self.config.registration.enable_registration:
            yield "Regular (non-PubHubs) user registration is enabled - please set 'enable_registration' in 'homeserver.yaml' to false."

    def check_password_login_disabled(self):
        if self.config.auth.password_enabled_for_login or self.config.auth.password_enabled_for_reauth:
            yield f"Password login enabled; please disable it by setting 'enabled: false' under 'password_config:' in 'homeserver.yaml'"

    def check_federation_is_disabled(self):
        if self.config.federation.federation_domain_whitelist != {}:
            yield f"Federation must be disabled by setting 'federation_domain_whitelist: []' in 'homeserver.yaml' - the current federation whitelist is: {self.config.federation.federation_domain_whitelist}"

    def check_per_room_profiles_are_disabled(self):
        if self.config.server.allow_per_room_profiles:
            yield "Please set 'allow_per_room_profiles: false' in 'homeserver.yaml'"


    def signing_key_changed(self):
        for key in self.config.key.signing_key:
            if bytes(key) == b'\xee\xe9@\x8c\xd2R\x7ft\x15\x1e\x03#\xc8\xf3[\xb9\x89\x95\x9b\x80\xe6\x06\xbd\n\xb7~"5\x91%v\xac':
                return False
        return True

    def macaroon_secret_changed(self):
        return self.config.key.macaroon_secret_key != b"macaroon_key"

    def form_secret_changed(self):
        return self.config.key.form_secret != "form_secret"

    def check_no_profile_lookups_over_federation(self):
        if self.config.federation.allow_profile_lookup_over_federation:
            yield "Please set 'allow_profile_lookup_over_federation: false' in 'homeserver.yaml'"

    def client_url_changed(self):
        client_url = self.modules[pubhubs.HubClientApi].get("client_url", None)
        if client_url == None:
            raise ConfigError("Please set 'client_url' in the configuration of the 'HubClientApi' module")
        return not client_url.startswith("http://localhost")

    def global_client_url_changed(self):
        global_client_url = self.modules[pubhubs.HubClientApi].get("global_client_url", None)
        if global_client_url == None:
            raise ConfigError("Please set 'global_client_url' in the configuration of the 'HubClientApi' module")
        return global_client_url != "http://localhost:8080"

    def issuer_changed(self):
        op, = self.config.oidc.oidc_providers
        return op.issuer != "http://host.docker.internal:8080"

    def client_id_changed(self):
        op, = self.config.oidc.oidc_providers
        return not op.client_id.startswith("testhub")

    def server_name_changed(self):
        return self.config.server.server_name != "testhub.matrix.host"

    def public_baseurl_changed(self):
        return self.config.server.public_baseurl != "http://localhost:8008/"


    def check_client_is_whitelisted(self):
        client_url: str = self.modules[pubhubs.HubClientApi]["client_url"]
        # C.f. https://github.com/element-hq/synapse/blob/f4e12ceb1fc2a02b2c3deed4530cea0a601ec4df/synapse/handlers/auth.py#L277
        whitelist: tuple[str] = tuple(self.config.sso.sso_client_whitelist)
        if not client_url.startswith(whitelist):
            yield f"Please add your client url ({client_url}) - or a prefix of it - to 'sso -> client_whitelist' ({whitelist})"
        if not 'https://app.pubhubs.net' in whitelist:
            yield "Please add 'https://app.pubhubs.net' to 'sso -> client_whitelist'"

    def check_server_notices_localpart(self):
        # TODO: development and production currently use different localparts for the notices user.
        # Is this a bug?  I've sent Harm an email to inquire about this.
        ADMISSIBLE = ('notices',  # used on main and stable
                      'notices_user', # used in development setup
                      )
        lp = self.config.servernotices.server_notices_mxid
        if not lp.startswith(tuple([f"@{localpart}:" for localpart in  ADMISSIBLE])):
            yield ("Please set the localpart of the server notices user mxid's (currently being {lp}) " +
                   f"via server_notices -> system_mxid_localpart to one of {ADMISSIBLE}")

    def check_oidc_provider(self):
        oidc_providers = self.config.oidc.oidc_providers
        match len(oidc_providers):
            case 0:
                yield "No OIDC providers configured - please add  the pubhubs OIDC provider under 'oidc_providers'."
                return
            case 1:
                pass # ok
            case _:
                yield "Please only use the pubhubs OIDC provider under 'oidc_providers'"
                return

        op, = oidc_providers

        if op.idp_id != "oidc-pubhubs":
            # NOTE: synapse prefixes idp_ud with  "oidc-", see
            # https://github.com/element-hq/synapse/blob/1198f649ea91bcc21ae5b596ad50bf1851de2589/synapse/config/oidc.py#L258
            yield f"Please use 'pubhubs' and not {op.idp_id[len('oidc-'):]} as 'idp_id' under 'oidc_providers'"

        if not op.discover:
            yield f"Please set 'discover' to true in the under 'oidc_providers'"

        if "openid" not in op.scopes:
            yield f"Please include 'openid' in 'scopes' (currently: {tuple(op.scopes)}) under 'oidc_providers'"

        if op.skip_verification:
            yield f"Please set 'skip_verification' under 'oidc_providers' to false"

        if op.user_mapping_provider_class != pseudonyms.OidcMappingProvider:
            yield f"Please set 'user_mapping_provider' -> 'module' to 'conf.modules.pseudonyms.OidcMappingProvider' - current value: {repr(op.user_mapping_provider_class)}"

        # op.user_mapping_provider_config is checked by the module itself
