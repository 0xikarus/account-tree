import { build, outdir } from "./build.js";

await build();
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 3210),
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
    const name = path === "/" || path === "/index.html" ? "index.html" : path === "/app.js" ? "app.js" : null;
    if (!name) return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : Bun.file(`${outdir}/${name}`), {
      headers: {
        "Content-Type": name.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      },
    });
  },
});
console.log(`Account tree: ${server.url}`);
