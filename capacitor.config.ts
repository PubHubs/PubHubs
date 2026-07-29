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
		allowNavigation: ['localhost:8008', 'localhost:8009', 'localhost:8010', 'localhost:8011', 'localhost:8012'],
	},
	android: {
		buildOptions: {
			keystorePath: undefined,
		},
	},
};

export default config;
