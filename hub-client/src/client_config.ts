import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('ClientConfig');

function adjustClientConfig() {
	for (const key of ['HUB_URL', 'PARENT_URL']) {
		const vite_key = `VITE_${key}`;
		if (vite_key in import.meta.env) {
			_env[key] = import.meta.env[vite_key];
		}
	}
	logger.info(_env);
}

export { adjustClientConfig };
