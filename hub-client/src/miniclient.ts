import { createApp } from 'vue';
import '@/registerServiceWorker';
import '@/assets/tailwind.css';
import Miniclient from '@/pages/Miniclient.vue';
import { createPinia } from 'pinia';
import Badge from './components/elements/Badge.vue';
import { setUpi18n } from '@/i18n';
import { registerPlugins } from './registerPlugins';

import { adjustClientConfig } from './client_config';
adjustClientConfig();

const pinia = createPinia();
const app = createApp(Miniclient);

registerPlugins(app);

app.component('Badge', Badge);

const i18n = setUpi18n(app);
app.use(i18n);

app.use(pinia);
app.mount('#app');
