type ProductionMode = 'production' | 'development';

export default class Config {
	public getProductionMode(): ProductionMode {
		//@ts-expect-error
		if (!_env?.PARENT_URL || typeof _env.PARENT_URL !== 'string') {
			console.error('PARENT_URL is not defined in the environment');
			return 'production';
		}

		//@ts-expect-error
		if (_env.PARENT_URL.startsWith('https://main.pubhubs') || _env.PARENT_URL.startsWith('http://localhost')) {
			return 'development';
		} else {
			return 'production';
		}
	}
}

const CONFIG = new Config();
export { CONFIG };
