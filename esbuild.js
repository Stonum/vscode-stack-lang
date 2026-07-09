const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = {
   name: "esbuild-problem-matcher",
   setup(build) {
      build.onStart(() => {
         console.log("[build] started");
      });
      build.onEnd((result) => {
         result.errors.forEach(({ text, location }) => {
            console.error(`✘ [ERROR] ${text}`);
            console.error(
               `    ${location.file}:${location.line}:${location.column}:`,
            );
         });
         console.log("[build] finished");
      });
   },
};

async function main() {
   const ctx = await esbuild.context({
      entryPoints: ["src/extension.ts"],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node18",
      outfile: "dist/extension.js",
      external: ["vscode"],
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      logLevel: "silent",
      plugins: [esbuildProblemMatcherPlugin],
   });

   if (watch) {
      await ctx.watch();
   } else {
      await ctx.rebuild();
      await ctx.dispose();
   }
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
