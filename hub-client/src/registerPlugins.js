/**
 *
 * Globally register plugins in 'plugins' folder.
 *
 */

export const registerPlugins = (app) => {
	const pluginFiles = import.meta.glob('./plugins/plugin.*.{js,ts}');

	app.config.globalProperties._plugins = [];

	for (const path in pluginFiles) {
		pluginFiles[path]().then((pluginModule) => {
			const pluginConfig = pluginModule.plugin;
			pluginConfig._path = path.replace(/\.\/plugins\/(.*?)\/.*/g, '$1'); // Transform name to path
			app.config.globalProperties._plugins.push(pluginConfig);
		});
	}
};

export const registerPluginComponents = (app) => {
	const componentFiles = import.meta.glob('./plugins/Plugin[A-Z]*.vue');

	for (const path in componentFiles) {
		componentFiles[path]().then((componentModule) => {
			const componentName =
				path
					.split('/')
					.pop()
					?.replace(/\.\w+$/, '') || '';
			app.component(componentName, componentModule.default || componentModule);
		});
	}
};
