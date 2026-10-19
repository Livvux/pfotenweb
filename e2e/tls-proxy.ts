import { createServer } from "node:https";
import { request } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** WebKit requires HTTPS for production Secure cookies, including *.localhost. */
export async function localTlsProxy(baseURL: string) {
  const upstream = new URL(baseURL);
  if (!upstream.hostname.endsWith("localhost")) throw new Error("TLS test proxy requires localhost");
  const dir = await mkdtemp(join(tmpdir(), "pfotenweb-e2e-tls-"));
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")], { stdio: "ignore" });
    const server = createServer({ key: await readFile(join(dir, "key.pem")), cert: await readFile(join(dir, "cert.pem")) }, (incoming, response) => {
      const outgoing = request({ hostname: "127.0.0.1", port: upstream.port, path: incoming.url, method: incoming.method, headers: { ...incoming.headers, "x-forwarded-proto": "https" } }, result => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      });
      outgoing.on("error", () => { response.writeHead(502); response.end(); });
      incoming.pipe(outgoing);
    });
    await new Promise<void>(resolve => server.listen(Number(process.env.E2E_TLS_PORT ?? 0), "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing TLS proxy port");
    return { baseURL: `https://${upstream.hostname}:${address.port}`, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
