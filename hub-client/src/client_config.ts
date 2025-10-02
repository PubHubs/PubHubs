function adjustClientConfig() {
	for (var key of ['HUB_URL', 'PARENT_URL']) {
		const vite_key = `VITE_${key}`;
		if (vite_key in import.meta.env) {
			_env[key] = import.meta.env[vite_key];
		}
	}
	console.error(_env);
}

export { adjustClientConfig };
