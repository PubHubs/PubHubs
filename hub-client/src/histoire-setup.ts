import './assets/tailwind.css';

import { createPinia } from 'pinia';
import { defineSetupVue3 } from '@histoire/plugin-vue';
import { setUpi18n } from '@/i18n';
import { twClass } from '@/core/directives';

// @ts-ignore
import H2 from '@/components/elements/H2.vue';
// @ts-ignore
import H3 from '@/components/elements/H3.vue';
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
// @ts-ignore
import TextArea from '@/components/forms/TextArea.vue';
// @ts-ignore
import Checkbox from '@/components/forms/Checkbox.vue';
// @ts-ignore
import Select from '@/components/forms/Select.vue';
// @ts-ignore
import Label from '@/components/forms/Label.vue';
// @ts-ignore
import FormLine from '@/components/forms/FormLine.vue';
// @ts-ignore
import FormObjectInputContent from '@/components/forms/FormObjectInputContent.vue';
// @ts-ignore
import Tabs from '@/components/ui/Tabs.vue';
// @ts-ignore
import TabContainer from '@/components/ui/TabContainer.vue';
// @ts-ignore
import TabContent from '@/components/ui/TabContent.vue';
// @ts-ignore
import TabHeader from '@/components/ui/TabHeader.vue';
// @ts-ignore
import TabPill from '@/components/ui/TabPill.vue';

const i18n = setUpi18n();
const _env = {
	HUB_URL: '',
};

export const setupVue3 = defineSetupVue3(({ app, story, variant }) => {
	app.use(createPinia());
	app.use(i18n);

	// Global directives
	app.directive('tw-class', twClass);

	// Global components
	app.component('H2', H2);
	app.component('H3', H3);
	app.component('Icon', Icon);
	app.component('Line', Line);
	app.component('Button', Button);
	app.component('TruncatedText', TruncatedText);
	app.component('TextInput', TextInput);
	app.component('TextArea', TextArea);
	app.component('Checkbox', Checkbox);
	app.component('Select', Select);
	app.component('Label', Label);
	app.component('FormLine', FormLine);
	app.component('FormObjectInputContent', FormObjectInputContent);
	app.component('Tabs', Tabs);
	app.component('TabContainer', TabContainer);
	app.component('TabContent', TabContent);
	app.component('TabHeader', TabHeader);
	app.component('TabPill', TabPill);
});
