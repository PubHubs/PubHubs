function adjustClientConfig() {
	for (const key of ['HUB_URL', 'PARENT_URL']) {
		const vite_key = `VITE_${key}`;
		if (vite_key in import.meta.env) {
			// @ts-expect-error
			_env[key] = import.meta.env[vite_key];
		}
	}
	// @ts-expect-error
	console.log(_env);
}

export { adjustClientConfig };
