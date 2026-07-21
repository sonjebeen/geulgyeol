import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("keeps coaching available when an OpenAI key is not configured", async () => {
  const fallback = {
    keep: "안정적인 흐름은 유지하세요.",
    fix: "크기를 일정하게 맞춰 보세요.",
    reason: "높이가 달라지면 문장이 흔들려 보여요.",
    tip: "가이드 선에 글자 높이를 맞춰 보세요.",
    exercise: ["마음", "기록", "하루"],
    encouragement: "한 가지만 연습해도 충분해요.",
    characterTarget: "",
    characterFinding: "",
    characterEvidence: "",
    characterConfidence: "low",
  };
  const response = await render(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "오늘의 마음을 기록합니다.", summary: {}, fallback }),
    }),
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, "local");
  assert.deepEqual(result.feedback, fallback);
});

test("includes focused character practice and motion heatmap controls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /한 글자 집중 연습실/);
  assert.match(source, /속도 히트맵 분석하기/);
  assert.match(source, /획순 재생/);
  assert.match(source, /drawSpeedHeatmap/);
});

test("includes the local character map and direct correction path", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /문장 해부도/);
  assert.match(source, /고정 글자 칸 획 매칭 · API 0원/);
  assert.match(source, /analyzePromptCharacters/);
  assert.match(source, /splitSampleIntoPromptCells/);
  assert.match(source, /이 글자 집중 교정/);
  assert.match(source, /1→3회/);
});

test("uses fixed character cells for reliable prompt alignment", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /한 칸에 한 글자씩 써 주세요/);
  assert.match(source, /getPromptCellLayout/);
  assert.match(source, /PromptCellGuide/);
  assert.match(source, /hasEnoughSentenceInk/);
  assert.match(styles, /\.character-grid-paper/);
  assert.match(styles, /\.prompt-cell-guide\.filled/);
});

test("includes personal handwriting beautification and tracing", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /내 글씨 예쁘게 만들기/);
  assert.match(source, /단정한 정리체/);
  assert.match(source, /둥근 온기체/);
  assert.match(source, /가벼운 흐름체/);
  assert.match(source, /drawReconstructedText/);
  assert.match(source, /buildPersonalizedStrokeSample/);
  assert.match(source, /drawPersonalizedStrokeText/);
  assert.match(source, /smoothStrokePoints/);
  assert.match(source, /getPersonalHandwritingCenterline/);
  assert.match(source, /const personalCenterline =/);
  assert.match(source, /const targetCenterY = clamp/);
  assert.doesNotMatch(source, /profile\.baseline/);
  assert.match(source, /const uniformScale = mixNumber/);
  assert.doesNotMatch(source, /const desiredWidth =/);
  assert.doesNotMatch(source, /const desiredHeight =/);
  assert.match(source, /decomposeHangulCharacter/);
  assert.match(source, /classifyHangulStroke/);
  assert.match(source, /classifyHangulStrokes/);
  assert.match(source, /HANGUL_JAMO_STROKE_COUNTS/);
  assert.match(source, /buildHangulComponentOffsets/);
  assert.match(source, /BeautyComparisonSlider/);
  assert.match(source, /자모 구조 보정/);
  assert.match(source, /늘이기 없음/);
  assert.match(source, /받침 바닥선 보호/);
  assert.match(source, /원본과 교정본 비교 위치/);
  assert.match(source, /correctionStrength = mixNumber/);
  assert.match(source, /ReconstructedTextCanvas/);
  assert.match(source, /PROMPT_GRID_END - PROMPT_GRID_START/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth"/);
  assert.match(source, /획 비율 그대로/);
  assert.match(source, /내 글자 중심선 계산 완료/);
  assert.match(source, /--personal-centerline/);
  assert.match(source, /API 비용 0원/);
  assert.match(source, /min="40"/);
  assert.match(source, /scoreAgainstReconstructedText/);
  assert.match(source, /가이드 유사도 확인/);
  assert.match(layout, /@fontsource\/gowun-dodum\/korean-400\.css/);
  assert.match(layout, /@fontsource\/jua\/korean-400\.css/);
  assert.match(layout, /@fontsource\/nanum-pen-script\/korean-400\.css/);
});
