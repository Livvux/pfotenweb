import assert from "node:assert/strict";
import { mailTemplates, renderMail } from "../src/lib/mail-render";
for (const template of mailTemplates) {
  const html = renderMail('Hallo <script>alert("test")</script>\n\nZweite Zeile & Schluss', '<img src="https://example.org/tracker">', template, 'red; background:url(https://example.org)');
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; Schluss/);
  assert.doesNotMatch(html, /<script|<img|<[^>]+\ssrc=|url\(/i);
  assert.match(html, /Zweite Zeile/);
  if (template === "farbkopf") assert.match(html, /border-top:8px solid #1e4334/);
}
console.log("Three mail templates escape content and contain no remote assets: OK");
