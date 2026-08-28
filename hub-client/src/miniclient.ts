// Assets
// Packages
import { adjustClientConfig } from './client_config';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import '@hub-client/assets/tailwind.css';

// Components
import Badge from '@hub-client/components/elements/Badge.vue';

// Pages
import Miniclient from '@hub-client/pages/Miniclient.vue';

adjustClientConfig();

const pinia = createPinia();
const app = createApp(Miniclient);

app.component('Badge', Badge);

// No i18n here on purpose: the whole miniclient tree (Miniclient -> Independent/Linked ->
// MiniclientBadge -> Badge) renders an unread dot and no text at all, and vue-i18n plus both
// locale files are ~205 KB. settings.setLanguage no-ops without _i18n, so the handshake is fine.
app.use(pinia);
app.mount('#app');
