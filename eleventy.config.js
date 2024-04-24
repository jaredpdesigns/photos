const fs = require("fs-extra");
const htmlmin = require("html-minifier");
const pluginWebC = require("@11ty/eleventy-plugin-webc");
const postcss = require("postcss");

module.exports = function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(pluginWebC, {
    components: "src/_includes/**/*.webc"
  });

  // Make CSS mo-betta
  eleventyConfig.addTemplateFormats("css");

  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (inputContent) {
      const result = await postcss([
        require("postcss-import"),
        require("postcss-nested"),
        require("postcss-each"),
        require("autoprefixer")
      ]).process(inputContent, { from: undefined, to: undefined });

      return async () => result.css;
    }
  });

  // 404 handling
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        bs.addMiddleware("*", (req, res) => {
          const content_404 = fs.readFileSync("dist/404.html");
          console.log(content_404);
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          res.write(content_404);
          res.end();
        });
      }
    }
  });

  // HTML minification
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
    }
    return content;
  });

  // Passthrough static stuffs
  eleventyConfig.addPassthroughCopy({
    static: "/"
  });
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "layouts",
      data: "data",
      output: "dist"
    },
    markdownTemplateEngine: "njk"
  };
};
