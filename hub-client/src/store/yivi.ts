/**
 * This store is used for scraping https://github.com/privacybydesign/pbdf-schememanager/ to get a list of issuers and attributes
 */

import { defineStore } from 'pinia';
import { Option, Options } from '@/composables/useFormInputEvents';

// const yiviRepo = 'https://github.com/privacybydesign/pbdf-schememanager/';
const schemeURL = '../yivi/yivi_attributes.json';

interface Attribute {
	attribute: string;
	description_url: string;
}

type Attributes = Array<Attribute>;

const useYivi = defineStore('yivi', {
	state: () => {
		return {
			attributes: [] as Attributes,
		};
	},

	getters: {
		attributesOptions(state): Options {
			const options = state.attributes.map((a) => {
				return {
					value: a.attribute,
					label: a.attribute,
				} as Option;
			});
			return options as unknown as Options;
		},
	},

	actions: {
		async fetchAttributes() {
			const url = schemeURL;
			const response = await fetch(url);
			this.attributes = await response.json();
		},
	},
});

export { useYivi, Attribute };
