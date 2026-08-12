import { type CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'nl.pubhubs.client',
	appName: 'PubHubs',
	webDir: 'global-client/dist',
	server: {
		cleartext: true,
		hostname: 'localhost',
		androidScheme: 'http',
		iosScheme: 'capacitor',
		allowNavigation: ['localhost'],
	},
	android: {
		buildOptions: {
			keystorePath: undefined,
		},
	},
};

export default config;
