import { mkdir, copyFile } from "node:fs/promises";

export const outdir = new URL("./dist/", import.meta.url).pathname;

export async function build() {
  const result = await Bun.build({
    entrypoints: [new URL("./src/app.js", import.meta.url).pathname],
    outdir,
    target: "browser",
    minify: true,
  });
  if (!result.success) throw new Error("Account tree build failed", { cause: result.logs });
  await mkdir(outdir, { recursive: true });
  await copyFile(new URL("./index.html", import.meta.url), `${outdir}/index.html`);
}

if (import.meta.main) {
  await build();
  console.log(`Static website built in ${outdir}`);
}
