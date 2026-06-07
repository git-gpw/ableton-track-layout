const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** Loads .html files as raw text strings */
const htmlPlugin = {
  name: "html-loader",
  setup(build) {
    const fs = require("node:fs/promises");
    build.onLoad({ filter: /\.html$/ }, async (args) => {
      const contents = await fs.readFile(args.path, "utf8");
      return { contents, loader: "text" };
    });
  },
};

const logPlugin = {
  name: "log",
  setup(build) {
    build.onStart(() => console.log("[build] started"));
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}`);
      });
      if (result.errors.length === 0) console.log("[build] done");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    logLevel: "warning",
    plugins: [htmlPlugin, logPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
