import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ["/", ["mock-uyap.html", "text/html; charset=utf-8"]],
  ["/mock-uyap.html", ["mock-uyap.html", "text/html; charset=utf-8"]],
  ["/mock-uyap.js", ["mock-uyap.js", "text/javascript; charset=utf-8"]],
  ["/content-uyap.js", ["content-uyap.js", "text/javascript; charset=utf-8"]],
]);

createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const entry = files.get(pathname);

  if (!entry) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const content = await readFile(join(root, entry[0]));
    response.writeHead(200, {
      "Content-Type": entry[1],
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Server error");
  }
}).listen(4173, "127.0.0.1", () => {
  console.log("CELSE mock: http://localhost:4173/mock-uyap.html");
});
