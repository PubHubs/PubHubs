declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vue module declaration requires generic component typing
	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
	export default component;
}
