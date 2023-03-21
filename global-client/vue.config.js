const { defineConfig } = require("@vue/cli-service");
const path = require("path");
module.exports = defineConfig({
    configureWebpack: {
        devtool: "source-map",
        resolve: {
            fallback: {
                crypto: false,
            },
        },
    },
    chainWebpack(config) {
        config.resolve.symlinks(false);
        config.resolve.alias.set("vue", path.resolve("./node_modules/vue"));
        config.resolve.alias.set("pinia", path.resolve("./node_modules/pinia"));
    },
    transpileDependencies: true,
    publicPath: "/client",
});
