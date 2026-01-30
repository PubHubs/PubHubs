// Logic
import { LogLevel } from '@hub-client/logic/logging/statusTypes';

// Types
type ProductionMode = 'production' | 'development' | 'local development' | 'testing';

export default class Config {
	_productionMode: ProductionMode;

	_logLevelToStartLoggingFrom: LogLevel = LogLevel.Info;

	_env = {
		HUB_URL: 'https://example.com/hub-url-in-hub-client-not-set!',
		PARENT_URL: 'https://example.com/parent-url-in-hub-client-not-set!',
	};

	public constructor() {
		this._productionMode = this.getInitProductionMode();

		this._logLevelToStartLoggingFrom = this.getInitLogLevel(this._productionMode);

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
		console.log('CONFIG', this._env);
	}

	public get productionMode(): ProductionMode {
		return this._productionMode;
	}

	public get logLevelToStartLoggingFrom(): LogLevel {
		return this._logLevelToStartLoggingFrom;
	}

	private getInitProductionMode(): ProductionMode {
		// @ts-expect-error
		const globalClientUrl = _env.PUBHUBS_URL || _env.PARENT_URL;

		if (!globalClientUrl || typeof globalClientUrl !== 'string') {
			// @ts-expect-error
			if (globalThis._env.HUB_URL === 'http://testing') {
				return 'testing';
			}
			console.error('PUBHUBS_URL is not defined in the environment');
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

	private getInitLogLevel(productionMode: ProductionMode) {
		if (productionMode !== 'testing') console.log('production mode: ', productionMode);
		switch (productionMode) {
			case 'production':
				return LogLevel.Trace;
			case 'development':
				return LogLevel.Trace;
			case 'local development':
				return LogLevel.Info;
		}
	}
}

const CONFIG = new Config();
export { CONFIG };
