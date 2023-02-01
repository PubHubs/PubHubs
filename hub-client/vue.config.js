const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  configureWebpack: {
    devtool: "source-map",
    resolve: {
      fallback: {
        crypto: false,
      },
    },
  },
  transpileDependencies: true,
  publicPath: "/",
  // publicPath:
  //   process.env.NODE_ENV === "production"
  //     ? ("/" + process.env.CI_PROJECT_NAME + "/").replace(/\/\//g, "/")
  //     : "/",
});
