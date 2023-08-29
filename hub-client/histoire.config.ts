import { defineConfig } from 'histoire';
import { HstVue } from '@histoire/plugin-vue';

export default defineConfig({
    setupFile: './src/histoire-setup.ts',
    plugins: [HstVue()],
    vite: {
        server: {
            host: true,
        },
    },
    autoApplyContrastColor: true,
    backgroundPresets: [
        {
            label: 'Transparent',
            color: '',
        },
        {
            label: 'Light',
            color: '#fff',
            contrastColor: '#333',
        },
        {
            label: 'Dark',
            color: '#001242',
            contrastColor: '#eee',
        },
    ],
    theme: {
        title: 'PubHubs Client Theming',
        logo: {
            square: './src/assets/pubhubs-logo.svg',
            light: './src/assets/pubhubs-logo.svg',
            dark: './src/assets/pubhubs-logo-dark.svg',
        },
    },
});
