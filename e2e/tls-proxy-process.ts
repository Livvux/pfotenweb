import { localTlsProxy } from "./tls-proxy";
async function main() {
  const proxy = await localTlsProxy(process.env.E2E_HTTP_BASE_URL ?? "http://localhost:3001");
  console.log(`Local TLS test proxy ready at ${proxy.baseURL}`);
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void proxy.close().then(() => process.exit(0)); });
}
void main();
