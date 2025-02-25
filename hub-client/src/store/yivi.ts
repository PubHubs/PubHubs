/**
 * This store is used for keeping a curated list of all used yivi attributes
 * https://github.com/privacybydesign/pbdf-schememanager/ to get the most recent list of issuers and attributes
 */

import { defineStore } from 'pinia';
import { Option, Options } from '@/composables/useFormInputEvents';

// const yiviRepo = 'https://github.com/privacybydesign/pbdf-schememanager/';

interface Attribute {
	attribute: string;
	description: string;
}

type Attributes = Array<Attribute>;

const curatedAttributes: Attributes = [
	{ attribute: 'pbdf.sidn-pbdf.email.email', description: 'attribute.email' },
	{ attribute: 'pbdf.sidn-pbdf.email.domain', description: 'attribute.emaildomain' },
	{ attribute: 'pbdf.nijmegen.address.street', description: 'attribute.street' },
	{ attribute: 'pbdf.nijmegen.address.houseNumber', description: 'attribute.housenumber' },
	{ attribute: 'pbdf.nijmegen.address.zipcode', description: 'attribute.zipcode' },
	{ attribute: 'pbdf.nijmegen.address.city', description: 'attribute.city' },
	{ attribute: 'pbdf.nijmegen.address.municipality', description: 'attribute.municipality' },
	{ attribute: 'pbdf.nijmegen.personalData.fullname', description: 'attribute.fullname' },
	{ attribute: 'pbdf.nijmegen.personalData.firstnames', description: 'attribute.firstname' },
	{ attribute: 'pbdf.nijmegen.personalData.surname', description: 'attribute.familyname' },
	{ attribute: 'pbdf.nijmegen.personalData.dateofbirth', description: 'attribute.dateofbirth' },
	{ attribute: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', description: 'attribute.phonenumber' },
	{ attribute: 'pbdf.nijmegen.ageLimits.over12', description: 'attribute.over12' },
	{ attribute: 'pbdf.nijmegen.ageLimits.over16', description: 'attribute.over16' },
	{ attribute: 'pbdf.nijmegen.ageLimits.over18', description: 'attribute.over18' },
	{ attribute: 'pbdf.nijmegen.ageLimits.over21', description: 'attribute.over21' },
	{ attribute: 'pbdf.nijmegen.ageLimits.over65', description: 'attribute.over65' },
	{ attribute: 'pbdf.pbdf.surfnet.institute', description: 'attribute.surfinstitute' },
	{ attribute: 'pbdf.pbdf.surfnet.type', description: 'attribute.surftype' },
	{ attribute: 'pbdf.pbdf.surfnet.id', description: 'attribute.surfid' },
	{ attribute: 'pbdf.pbdf.surfnet.fullname', description: 'attribute.surffullname' },
	{ attribute: 'pbdf.pbdf.surfnet.firstname', description: 'attribute.surffirstname' },
	{ attribute: 'pbdf.pbdf.surfnet.familyname', description: 'attribute.surffamilyname' },
	{ attribute: 'pbdf.pbdf.surfnet.email', description: 'attribute.surfemail' },
];

const useYivi = defineStore('yivi', {
	state: () => {
		return {
			attributes: curatedAttributes as Attributes,
		};
	},

	getters: {
		attributesOptions(state): Options {
			const options = state.attributes.map((a) => {
				return {
					value: a.attribute,
					label: a.description,
				} as Option;
			});
			return options;
		},
	},
});

export { useYivi, Attribute };
