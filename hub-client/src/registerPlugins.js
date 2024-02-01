/**
 *
 * Globally register plugins in 'plugins' folder.
 *
 */

const requirePlugin = require.context(
	'./plugins',
	// Whether or not to look in subfolders
	true,
	// The regular expression used to match plugin filenames
	/plugin.*\.(js|ts)$/,
);

export const registerPlugins = (app) => {
	// register all the plugins in a global variable
	app.config.globalProperties._plugins = [];
	requirePlugin.keys().forEach((fileName) => {
		let pluginConfig = requirePlugin(fileName);
		pluginConfig.plugin._path = fileName.replace(/\.\/(.*?)\/.*/g, '$1'); // Transform name, to path. Skipping filename part.
		app.config.globalProperties._plugins.push(pluginConfig.plugin);
	});
};

const requirePluginComponent = require.context(
	'./plugins',
	// Whether or not to look in subfolders
	true,
	// The regular expression used to match base component filenames
	/Plugin[A-Z]\w+\.vue$/,
);

export const registerPluginComponents = (app) =>
	requirePluginComponent.keys().forEach((fileName) => {
		const componentConfig = requirePluginComponent(fileName);
		const componentName = fileName
			.split('/')
			.pop()
			.replace(/\.\w+$/, '');
		app.component(componentName, componentConfig.default || componentConfig);
	});
