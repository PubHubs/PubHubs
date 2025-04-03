/**
 * This store is used for keeping a curated list of all used yivi attributes
 * https://github.com/privacybydesign/pbdf-schememanager/ to get the most recent list of issuers and attributes
 */

import { defineStore } from 'pinia';
import { Option, Options } from '@/logic/composables/useFormInputEvents';

// const yiviRepo = 'https://github.com/privacybydesign/pbdf-schememanager/';

interface Attribute {
	attribute: string;
	description: string;
}

type Attributes = Array<Attribute>;

const curatedAttributes: Attributes = [
	{ attribute: 'pbdf.sidn-pbdf.email.email', description: 'attribute.email' },
	{ attribute: 'pbdf.sidn-pbdf.email.domain', description: 'attribute.emaildomain' },
	{ attribute: 'pbdf.gemeente.address.street', description: 'attribute.street' },
	{ attribute: 'pbdf.gemeente.address.houseNumber', description: 'attribute.housenumber' },
	{ attribute: 'pbdf.gemeente.address.zipcode', description: 'attribute.zipcode' },
	{ attribute: 'pbdf.gemeente.address.city', description: 'attribute.city' },
	{ attribute: 'pbdf.gemeente.address.municipality', description: 'attribute.municipality' },
	{ attribute: 'pbdf.gemeente.personalData.fullname', description: 'attribute.fullname' },
	{ attribute: 'pbdf.gemeente.personalData.firstnames', description: 'attribute.firstname' },
	{ attribute: 'pbdf.gemeente.personalData.surname', description: 'attribute.familyname' },
	{ attribute: 'pbdf.gemeente.personalData.dateofbirth', description: 'attribute.dateofbirth' },
	{ attribute: 'pbdf.gemeente.personalData.gender', description: 'attribute.gender' },
	{ attribute: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', description: 'attribute.phonenumber' },
	{ attribute: 'pbdf.gemeente.personalData.over12', description: 'attribute.over12' },
	{ attribute: 'pbdf.gemeente.personalData.over16', description: 'attribute.over16' },
	{ attribute: 'pbdf.gemeente.personalData.over18', description: 'attribute.over18' },
	{ attribute: 'pbdf.gemeente.personalData.over21', description: 'attribute.over21' },
	{ attribute: 'pbdf.gemeente.personalData.over65', description: 'attribute.over65' },
	{ attribute: 'pbdf.pbdf.surfnet-2.institute', description: 'attribute.surfinstitute' },
	{ attribute: 'pbdf.pbdf.surfnet-2.type', description: 'attribute.surftype' },
	{ attribute: 'pbdf.pbdf.surfnet-2.id', description: 'attribute.surfid' },
	{ attribute: 'pbdf.pbdf.surfnet-2.fullname', description: 'attribute.surffullname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.firstname', description: 'attribute.surffirstname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.familyname', description: 'attribute.surffamilyname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.email', description: 'attribute.surfemail' },
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
