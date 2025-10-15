import fs from "fs-extra";
import htmlmin from "html-minifier";
import pluginWebC from "@11ty/eleventy-plugin-webc";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import postcssImport from "postcss-import";
import postcssNested from "postcss-nested";
import postcssEach from "postcss-each";

export default function (eleventyConfig) {
  /*
   * Plugins
   */
  eleventyConfig.addPlugin(pluginWebC, {
    components: "src/_includes/**/*.webc"
  });

  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    statsOnly: true,
    cacheOptions: {
      duration: "30d",
      directory: ".cache/eleventy-img",
      removeUrlQueryParams: false
    },
    formats: ["avif", "webp", "jpeg"],
    htmlOptions: {
      sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1024px",
      imgAttributes: {
        decoding: "async",
        loading: "lazy"
      }
    },
    urlFormat: ({ src, width, format }) => {
      // Only transform images from your image host
      if (!src.startsWith("https://images.jaredpendergraft.com/")) return src;

      const params = [
        `w=${width}`,
        `f=${format}`,
        "q=auto",
        "metadata=none",
        "onerror=redirect"
      ];

      return src.replace(
        /^https:\/\/([^/]+)/,
        `$&/cdn-cgi/image/${params.join(",")}`
      );
    },
    widths: [320, 480, 640, 1024, 1440, 1920] // consider a 2x/hero size if needed
  });

  /*
   * Make CSS mo-betta
   */
  eleventyConfig.addTemplateFormats("css");

  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (inputContent) {
      const result = await postcss([
        postcssImport,
        postcssNested,
        postcssEach,
        autoprefixer
      ]).process(inputContent, { from: undefined, to: undefined });

      return async () => result.css;
    }
  });

  /*
   * 404 handling
   */
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

  /*
   * HTML minification
   */
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

  /*
   * Passthrough static stuffs
   */
  eleventyConfig.addPassthroughCopy({
    static: "/"
  });
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  return {
    dir: {
      data: "_data",
      includes: "_includes",
      input: "src",
      layouts: "layouts",
      output: "dist"
    },
    markdownTemplateEngine: "njk"
  };
}
