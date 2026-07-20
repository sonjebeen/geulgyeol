type Feedback = {
  keep: string;
  fix: string;
  reason: string;
  tip: string;
  exercise: string[];
  encouragement: string;
};

type RequestBody = {
  prompt?: string;
  summary?: unknown;
  fallback?: Feedback;
};

const feedbackSchema = {
  type: "object",
  properties: {
    keep: { type: "string", description: "사용자의 안정적인 필체 개성을 칭찬하고 유지하라고 말하는 한두 문장" },
    fix: { type: "string", description: "오늘 고칠 단 한 가지를 구체적으로 설명하는 한 문장" },
    reason: { type: "string", description: "왜 이 한 가지가 가독성에 영향을 주는지 설명하는 한두 문장" },
    tip: { type: "string", description: "다음 필기에서 바로 실행할 수 있는 짧고 구체적인 팁" },
    exercise: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
      description: "해당 습관을 연습하기 좋은 한국어 단어 세 개",
    },
    encouragement: { type: "string", description: "사용자의 글씨 개성을 존중하는 짧은 응원" },
  },
  required: ["keep", "fix", "reason", "tip", "exercise", "encouragement"],
  additionalProperties: false,
};

function isFeedback(value: unknown): value is Feedback {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    ["keep", "fix", "reason", "tip", "encouragement"].every((key) => typeof item[key] === "string") &&
    Array.isArray(item.exercise) &&
    item.exercise.length === 3 &&
    item.exercise.every((word) => typeof word === "string")
  );
}

function readOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        return (part as Record<string, unknown>).text as string;
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!body.fallback || !isFeedback(body.fallback)) {
    return Response.json({ error: "분석 데이터가 부족합니다." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ mode: "local", feedback: body.fallback });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        store: false,
        input: [
          {
            role: "system",
            content:
              "당신은 성인 사용자를 위한 한국어 손글씨 동작 코치입니다. 사용자의 글씨를 표준 폰트처럼 바꾸려 하지 말고, 세 번 반복해서 쓴 결과에서 안정적인 특징은 개성으로 보존하세요. 가장 불안정한 요소 단 하나만 교정하세요. 측정값을 과장하거나 의학적 진단처럼 말하지 마세요. 모든 답변은 자연스럽고 다정한 한국어 존댓말로 작성하세요.",
          },
          {
            role: "user",
            content: `연습 문장: ${body.prompt ?? "한글 연습 문장"}\n\n세 번의 기기 내 동작 분석 요약:\n${JSON.stringify(body.summary)}\n\n기기 내 기본 해석:\n${JSON.stringify(body.fallback)}\n\n이 자료를 바탕으로 사용자의 개성은 유지하고, 오늘 연습할 한 가지에만 집중한 코칭을 작성하세요.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "hangul_handwriting_feedback",
            strict: true,
            schema: feedbackSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      return Response.json({ mode: "local", feedback: body.fallback });
    }

    const result = (await response.json()) as Record<string, unknown>;
    const outputText = readOutputText(result);
    if (!outputText) return Response.json({ mode: "local", feedback: body.fallback });
    const parsed = JSON.parse(outputText) as unknown;
    if (!isFeedback(parsed)) return Response.json({ mode: "local", feedback: body.fallback });
    return Response.json({ mode: "ai", feedback: parsed });
  } catch {
    return Response.json({ mode: "local", feedback: body.fallback });
  }
}
