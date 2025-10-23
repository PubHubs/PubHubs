// Packages
import { defineAsyncComponent } from 'vue';

export const registerComponents = (app) => {
	// Use import.meta.glob to dynamically import all components
	const components = import.meta.glob('./components/**/*.{vue,js,ts}');

	// Loop through the imported components
	for (const [fileName, resolver] of Object.entries(components)) {
		// Extract the component name from the file path
		const componentName = fileName
			.split('/')
			.pop()
			.replace(/\.\w+$/, ''); // Removes the file extension

		// Dynamically load and register the component
		app.component(componentName, defineAsyncComponent(resolver));
	}
};
