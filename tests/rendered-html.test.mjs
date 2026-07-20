import assert from "node:assert/strict";
import test from "node:test";

async function render(request = new Request("http://localhost/", { headers: { accept: "text/html" } })) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the GeulGyeol handwriting coach", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>글결 · 나만의 한글 필체 코치<\/title>/i);
  assert.match(html, /세 번 쓰면/);
  assert.match(html, /고칠 한 가지/);
  assert.match(html, /한글 필기 입력 영역/);
  assert.match(html, /Apple Pencil/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
