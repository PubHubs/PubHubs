import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('Config');

type ProductionMode = 'production' | 'development' | 'local development' | 'testing';

export default class Config {
	_productionMode: ProductionMode;

	_env: Record<string, string> = {
		HUB_URL: 'https://example.com/hub-url-in-hub-client-not-set!',
		PARENT_URL: 'https://example.com/parent-url-in-hub-client-not-set!',
	};

	public constructor() {
		this._productionMode = this.getInitProductionMode();

		for (const key of ['HUB_URL', 'PARENT_URL']) {
			// the global _env (not to be confused with this._env) is set by client-config.js
			if (key in _env) {
				this._env[key] = _env[key];
			}

			const vite_key = `VITE_${key}`;
			if (vite_key in import.meta.env) {
				this._env[key] = import.meta.env[vite_key];
			}
		}
		if (this._productionMode !== 'testing') logger.info('Initialized', { mode: this._productionMode, env: this._env });
	}

	public get productionMode(): ProductionMode {
		return this._productionMode;
	}

	private getInitProductionMode(): ProductionMode {
		const globalClientUrl = _env.PUBHUBS_URL || _env.PARENT_URL;

		if (!globalClientUrl || typeof globalClientUrl !== 'string') {
			if (_env.HUB_URL === 'http://testing') {
				return 'testing';
			}
			logger.error('PUBHUBS_URL is not defined in the environment');
			return 'production';
		}

		if (globalClientUrl.startsWith('https://main.pubhubs')) {
			return 'development';
		} else if (globalClientUrl.startsWith('http://localhost')) {
			return 'local development';
		} else if (globalClientUrl === 'http://testing') {
			return 'testing';
		} else {
			return 'production';
		}
	}
}

const CONFIG = new Config();
export { CONFIG };
