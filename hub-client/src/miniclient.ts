// Packages
import { adjustClientConfig } from './client_config';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

// Assets
import '@hub-client/assets/tailwind.css';

// Components
import Badge from '@hub-client/components/elements/Badge.vue';

// Pages
import Miniclient from '@hub-client/pages/Miniclient.vue';

// Other
import { setUpi18n } from '@hub-client/i18n';
import { registerPlugins } from '@hub-client/registerPlugins';
import '@hub-client/registerServiceWorker';

adjustClientConfig();

const pinia = createPinia();
const app = createApp(Miniclient);

registerPlugins(app);

app.component('Badge', Badge);

const i18n = setUpi18n(app);
app.use(i18n);

app.use(pinia);
app.mount('#app');
