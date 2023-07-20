import './assets/tailwind.css';

import { createPinia } from 'pinia';
import { defineSetupVue3 } from '@histoire/plugin-vue';
import { setUpi18n } from '@/i18n';
import { twClass } from '@/core/directives';

// @ts-ignore
import H2 from '@/components/elements/H2.vue';
// @ts-ignore
import Icon from '@/components/elements/Icon.vue';
// @ts-ignore
import Line from '@/components/elements/Line.vue';
// @ts-ignore
import Button from '@/components/elements/Button.vue';
// @ts-ignore
import TruncatedText from '@/components/elements/TruncatedText.vue';
// @ts-ignore
import TextInput from '@/components/forms/TextInput.vue';

const i18n = setUpi18n();

export const setupVue3 = defineSetupVue3(({ app, story, variant }) => {
	app.use(createPinia());
	app.use(i18n);

	// Global directives
	app.directive('tw-class', twClass);

	// Global components
	app.component('H2', H2);
	app.component('Icon', Icon);
	app.component('Line', Line);
	app.component('Button', Button);
	app.component('TruncatedText', TruncatedText);
	app.component('TextInput', TextInput);
});
