import { LogLevel } from '../dev/types';

type ProductionMode = 'production' | 'development' | 'local development';

export default class Config {
	_productionMode: ProductionMode;

	_logLevelToStartLoggingFrom: LogLevel = LogLevel.Info;

	public constructor() {
		this._productionMode = this.getInitProductionMode();

		this._logLevelToStartLoggingFrom = this.getInitLogLevel(this._productionMode);
	}

	public get productionMode(): ProductionMode {
		return this._productionMode;
	}

	public get logLevelToStartLoggingFrom(): LogLevel {
		return this._logLevelToStartLoggingFrom;
	}

	private getInitProductionMode(): ProductionMode {
		//@ts-expect-error
		const globalClientUrl = _env.PUBHUBS_URL || _env.PARENT_URL;

		if (!globalClientUrl || typeof globalClientUrl !== 'string') {
			console.error('PUBHUBS_URL is not defined in the environment');
			return 'production';
		}

		if (globalClientUrl.startsWith('https://main.pubhubs')) {
			return 'development';
		} else if (globalClientUrl.startsWith('http://localhost')) {
			return 'local development';
		} else {
			return 'production';
		}
	}

	private getInitLogLevel(productionMode: ProductionMode) {
		console.log('production mode: ', productionMode);
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
