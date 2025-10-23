const isProduction = process.env.NODE_ENV === 'production';

const ReplaceConsole = () => {
	// temporarily disabled for issue #790
	// logger.getLogger('matrix').setLevel(5);
	// const logReplacement =
	// 	(org: Function) =>
	// 	(...args: string[]) => {
	// 		if (!isProduction) {
	// 			args.unshift('color:#3EA439;font-weight:bold;');
	// 			args.unshift('%c[PH');
	// 			org(...args);
	// 		}
	// 	};
	// console.log = logReplacement(console.log);
	// console.debug = logReplacement(console.debug);
	// const css = 'color:#3EA439;font-weight:bold;';
	// console.info(' ');
	// console.info('%c[=== PubHubs Hub Client @' + window.location.href + ' ===]', css);
	// console.info('%c[=== Use the console wisely ;-)', css);
	// console.info(' ');
};

export { ReplaceConsole, isProduction };
