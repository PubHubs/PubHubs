const { defineConfig } = require('@vue/cli-service');
const path = require('path');
module.exports = defineConfig({
	configureWebpack: {
		devtool: 'source-map',
		resolve: {
			fallback: {
				crypto: false,
			},
		},
	},
	chainWebpack(config) {
		config.resolve.symlinks(false);
		config.resolve.alias.set('vue', path.resolve('./node_modules/vue'));
		config.resolve.alias.set('pinia', path.resolve('./node_modules/pinia'));
		config.plugin('define').tap((definitions) => {
			Object.assign(definitions[0], {
				__VUE_OPTIONS_API__: 'true',
				__VUE_PROD_DEVTOOLS__: 'false',
				__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
			});
			return definitions;
		});
	},
	pages: {
		index: {
			// entry for the page
			entry: 'src/main.ts',
			// the source template
      		template: 'public/index.html',
      		// output as dist/index.html
      		filename: 'index.html',
		},
		miniclient: {
			// entry for the page
			entry: 'src/miniclient.ts',
			// the source template
      		template: 'public/index.html',
      		// output as dist/index.html
      		filename: 'miniclient.html',
		},
	},
	transpileDependencies: true,
	publicPath: '/',
});
