/**
 * This store is used for keeping a curated list of all used yivi attributes
 * https://github.com/privacybydesign/pbdf-schememanager/ to get the most recent list of issuers and attributes
 */
// Packages
import { defineStore } from 'pinia';

// Models
import { Attribute } from '@hub-client/models/yivi/Tyivi';

const curatedAttributes: Attribute[] = [
	{ attribute: 'pbdf.sidn-pbdf.email.email' },
	{ attribute: 'pbdf.sidn-pbdf.email.domain' },
	{ attribute: 'pbdf.gemeente.address.street' },
	{ attribute: 'pbdf.gemeente.address.houseNumber' },
	{ attribute: 'pbdf.gemeente.address.zipcode' },
	{ attribute: 'pbdf.gemeente.address.city' },
	{ attribute: 'pbdf.gemeente.address.municipality' },
	{ attribute: 'pbdf.gemeente.personalData.fullname' },
	{ attribute: 'pbdf.gemeente.personalData.firstnames' },
	{ attribute: 'pbdf.gemeente.personalData.surname' },
	{ attribute: 'pbdf.gemeente.personalData.dateofbirth' },
	{ attribute: 'pbdf.gemeente.personalData.gender' },
	{ attribute: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber' },
	{ attribute: 'pbdf.gemeente.personalData.over12' },
	{ attribute: 'pbdf.gemeente.personalData.over16' },
	{ attribute: 'pbdf.gemeente.personalData.over18' },
	{ attribute: 'pbdf.gemeente.personalData.over21' },
	{ attribute: 'pbdf.gemeente.personalData.over65' },
	{ attribute: 'pbdf.pbdf.surfnet-2.institute' },
	{ attribute: 'pbdf.pbdf.surfnet-2.type' },
	{ attribute: 'pbdf.pbdf.surfnet-2.id' },
	{ attribute: 'pbdf.pbdf.surfnet-2.fullname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.firstname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.familyname' },
	{ attribute: 'pbdf.pbdf.surfnet-2.email' },
];

const useYivi = defineStore('yivi', {
	state: () => {
		return {
			attributes: curatedAttributes as Attribute[],
		};
	},

	actions: {
		getAttributes(t: (key: string, ...args: any[]) => string): Attribute[] {
			return this.attributes.map((a: Attribute) => {
				return {
					attribute: a.attribute,
					label: t('attribute.' + a.attribute),
				};
			});
		},
	},
});

export { useYivi };
