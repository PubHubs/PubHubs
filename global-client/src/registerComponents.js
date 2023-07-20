/**
 *
 * Globally register all components in 'components' folder.
 *
 */

const requireComponent = require.context(
	'./components',
	// Whether or not to look in subfolders
	true,
	// The regular expression used to match base component filenames
	/[A-Z]\w+\.(vue|js|ts)$/,
);

export const registerComponents = (app) =>
	requireComponent.keys().forEach((fileName) => {
		const componentConfig = requireComponent(fileName);
		const componentName = fileName
			.split('/')
			.pop()
			.replace(/\.\w+$/, '');
		app.component(componentName, componentConfig.default || componentConfig);
	});
