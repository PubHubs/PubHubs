export class ConsentJSONParser {
	needs_consent: boolean;
	needs_onboarding: boolean;

	constructor(needs_consent: boolean, needs_onboarding: boolean) {
		this.needs_consent = needs_consent;
		this.needs_onboarding = needs_onboarding;
	}
}

export class HubSettingsJSONParser {
	description: string;
	summary: string;
	contact: string;
	consent: string;
	version: number;

	constructor(description: string, summary: string, contact: string, consent: string, version: number) {
		this.description = description ? description.replace(/\\n/g, '\n').replace(/"/g, '') : '';
		this.summary = summary ? summary.replace(/\\n/g, '\n').replace(/"/g, '') : '';
		this.contact = contact ? contact.replace(/\\n/g, '\n').replace(/"/g, '') : '';
		this.consent = consent ? consent.replace(/\\n/g, '\n').replace(/"/g, '') : '';
		this.version = version ? Number(version) : 1;
	}
}
