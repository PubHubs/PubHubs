import { createApp } from 'vue';
import '@/registerServiceWorker';
import '@/assets/tailwind.css';
import Miniclient from '@/pages/Miniclient.vue';
import { createPinia } from 'pinia';
import Badge from './components/elements/Badge.vue';

const pinia = createPinia();
const app = createApp(Miniclient);

app.component('Badge', Badge);

app.use(pinia);
app.mount('#app');
