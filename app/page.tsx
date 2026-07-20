"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Point = {
  x: number;
  y: number;
  t: number;
  pressure: number | null;
  tiltX: number | null;
  tiltY: number | null;
};

type Stroke = {
  pointerType: string;
  points: Point[];
};

type Sample = {
  strokes: Stroke[];
  pointerType: string;
};

type SampleMetric = {
  width: number;
  height: number;
  area: number;
  duration: number;
  speed: number;
  strokeCount: number;
  rhythm: number;
  smoothness: number;
  pressure: number | null;
};

type AnalysisSummary = {
  consistency: number;
  focusKey: "size" | "speed" | "stroke" | "rhythm" | "shape";
  focusLabel: string;
  variations: {
    size: number;
    speed: number;
    stroke: number;
    rhythm: number;
    shape: number;
  };
  averages: {
    width: number;
    height: number;
    duration: number;
    speed: number;
    strokeCount: number;
  };
  samples: SampleMetric[];
};

type Feedback = {
  keep: string;
  fix: string;
  reason: string;
  tip: string;
  exercise: string[];
  encouragement: string;
  characterTarget: string;
  characterFinding: string;
  characterEvidence: string;
  characterConfidence: "high" | "medium" | "low";
};

type BeautyStyleKey = "neat" | "round" | "flow";

const PROMPTS = [
  "오늘의 마음을 천천히 기록합니다.",
  "작은 습관이 좋은 하루를 만듭니다.",
  "나만의 속도로 또박또박 써 내려갑니다.",
];

const BEAUTY_STYLES: Record<
  BeautyStyleKey,
  { name: string; english: string; description: string; changes: string[]; mark: string }
> = {
  neat: {
    name: "단정한 정리체",
    english: "NEAT",
    description: "글자별 기준선과 높이를 맞추고 가로·세로획을 또렷하게 펴요.",
    changes: ["기준선 정렬", "높이 통일", "직선 획 정돈"],
    mark: "가",
  },
  round: {
    name: "둥근 온기체",
    english: "ROUND",
    description: "글자 높이는 맞추고 원래 필체의 굴곡을 더 둥글고 크게 살려요.",
    changes: ["기준선 정렬", "곡선 강조", "넉넉한 너비"],
    mark: "동",
  },
  flow: {
    name: "가벼운 흐름체",
    english: "FLOW",
    description: "글자 사이를 정돈하고 오른쪽으로 흐르는 기울기를 분명하게 만들어요.",
    changes: ["간격 정돈", "오른쪽 기울기", "가벼운 리듬"],
    mark: "결",
  },
};

const FOCUS_COPY: Record<
  AnalysisSummary["focusKey"],
  { label: string; fix: string; reason: string; tip: string; exercise: string[] }
> = {
  size: {
    label: "글자 크기",
    fix: "글자의 높낮이가 반복할 때마다 조금씩 달라져요.",
    reason: "전체 글씨의 인상은 좋지만, 글자 높이가 흔들리면 문장이 울퉁불퉁해 보여요.",
    tip: "가운데 가이드 선을 글자의 허리선으로 생각하고 높이를 맞춰 보세요.",
    exercise: ["마음", "기록", "하루"],
  },
  speed: {
    label: "쓰기 속도",
    fix: "문장마다 펜이 움직이는 속도의 차이가 커요.",
    reason: "속도가 갑자기 바뀌면 획의 끝이 뭉치거나 글자 간격이 흔들릴 수 있어요.",
    tip: "첫 글자의 속도를 마지막 글자까지 유지한다는 느낌으로 써 보세요.",
    exercise: ["천천히", "나란히", "차분히"],
  },
  stroke: {
    label: "획의 생략",
    fix: "같은 문장을 쓰는데 획을 나누는 방식이 매번 달라져요.",
    reason: "획을 합치거나 급히 넘기는 순간이 달라지면 글자 모양도 함께 흔들려요.",
    tip: "받침과 모음을 한 번씩 또렷하게 마무리한 뒤 다음 글자로 이동해 보세요.",
    exercise: ["학교", "생각", "또박"],
  },
  rhythm: {
    label: "획의 리듬",
    fix: "짧은 획과 긴 획 사이의 리듬이 일정하지 않아요.",
    reason: "획마다 머무는 시간이 달라지면 글씨가 끊겨 보이거나 한쪽으로 몰려 보여요.",
    tip: "짧은 획은 가볍게, 긴 획은 한 호흡으로 끝까지 이어 보세요.",
    exercise: ["흐르다", "고르다", "이어짐"],
  },
  shape: {
    label: "글줄 균형",
    fix: "문장이 차지하는 가로·세로 비율이 반복할 때마다 달라져요.",
    reason: "글자의 개성은 유지되고 있지만 문장 전체의 중심선이 조금 흔들리고 있어요.",
    tip: "시작점과 끝점의 높이를 먼저 정한 뒤 그 사이를 채운다고 생각해 보세요.",
    exercise: ["가지런", "균형", "한결"],
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function coefficientOfVariation(values: number[]) {
  const average = mean(values);
  if (!average) return 0;
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}

function pointDistance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function measureSample(sample: Sample): SampleMetric {
  const allPoints = sample.strokes.flatMap((stroke) => stroke.points);
  if (!allPoints.length) {
    return {
      width: 0,
      height: 0,
      area: 0,
      duration: 0,
      speed: 0,
      strokeCount: 0,
      rhythm: 0,
      smoothness: 0,
      pressure: null,
    };
  }

  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const duration = Math.max(...allPoints.map((point) => point.t)) - Math.min(...allPoints.map((point) => point.t));
  let pathLength = 0;
  let turnTotal = 0;
  let turnCount = 0;

  sample.strokes.forEach((stroke) => {
    for (let index = 1; index < stroke.points.length; index += 1) {
      pathLength += pointDistance(stroke.points[index - 1], stroke.points[index]);
    }
    for (let index = 2; index < stroke.points.length; index += 1) {
      const a = stroke.points[index - 2];
      const b = stroke.points[index - 1];
      const c = stroke.points[index];
      const first = Math.atan2(b.y - a.y, b.x - a.x);
      const second = Math.atan2(c.y - b.y, c.x - b.x);
      let delta = Math.abs(second - first);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      turnTotal += delta;
      turnCount += 1;
    }
  });

  const strokeDurations = sample.strokes
    .map((stroke) => {
      if (stroke.points.length < 2) return 0;
      return stroke.points[stroke.points.length - 1].t - stroke.points[0].t;
    })
    .filter((value) => value > 0);
  const pressures = allPoints
    .map((point) => point.pressure)
    .filter((value): value is number => value !== null && value > 0);

  return {
    width,
    height,
    area: width * height,
    duration,
    speed: duration > 0 ? (pathLength / duration) * 1000 : 0,
    strokeCount: sample.strokes.length,
    rhythm: coefficientOfVariation(strokeDurations),
    smoothness: turnCount ? turnTotal / turnCount : 0,
    pressure: pressures.length ? mean(pressures) : null,
  };
}

function analyzeSamples(samples: Sample[]): AnalysisSummary {
  const metrics = samples.map(measureSample);
  const variations = {
    size: clamp(coefficientOfVariation(metrics.map((metric) => Math.sqrt(metric.area))), 0, 1),
    speed: clamp(coefficientOfVariation(metrics.map((metric) => metric.speed)), 0, 1),
    stroke: clamp(coefficientOfVariation(metrics.map((metric) => metric.strokeCount)), 0, 1),
    rhythm: clamp(coefficientOfVariation(metrics.map((metric) => metric.rhythm + 0.03)), 0, 1),
    shape: clamp(
      coefficientOfVariation(metrics.map((metric) => metric.width / Math.max(metric.height, 0.01))),
      0,
      1,
    ),
  };
  const weights = { size: 0.24, speed: 0.22, stroke: 0.2, rhythm: 0.16, shape: 0.18 };
  const weightedVariation = Object.entries(variations).reduce(
    (sum, [key, value]) => sum + value * weights[key as keyof typeof weights],
    0,
  );
  const focusKey = (Object.entries(variations).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "shape") as AnalysisSummary["focusKey"];

  return {
    consistency: Math.round(clamp(96 - weightedVariation * 125, 48, 96)),
    focusKey,
    focusLabel: FOCUS_COPY[focusKey].label,
    variations,
    averages: {
      width: mean(metrics.map((metric) => metric.width)),
      height: mean(metrics.map((metric) => metric.height)),
      duration: mean(metrics.map((metric) => metric.duration)),
      speed: mean(metrics.map((metric) => metric.speed)),
      strokeCount: mean(metrics.map((metric) => metric.strokeCount)),
    },
    samples: metrics,
  };
}

function buildFallbackFeedback(summary: AnalysisSummary): Feedback {
  const copy = FOCUS_COPY[summary.focusKey];
  const ratio = summary.averages.width / Math.max(summary.averages.height, 0.01);
  const keep =
    ratio > 4.8
      ? "가로로 시원하게 이어지는 필체가 이미 좋은 개성이에요. 이 흐름은 그대로 유지하세요."
      : summary.averages.speed > 0.42
        ? "망설임 없이 이어지는 경쾌한 필체가 장점이에요. 선의 에너지는 그대로 살려 보세요."
        : "차분하게 획을 마무리하는 필체가 장점이에요. 지금의 안정감은 그대로 유지하세요.";

  return {
    keep,
    fix: copy.fix,
    reason: copy.reason,
    tip: copy.tip,
    exercise: copy.exercise,
    encouragement: "전부 바꾸지 않아도 괜찮아요. 오늘은 이 한 가지만 맞춰 봐요.",
    characterTarget: "",
    characterFinding: "",
    characterEvidence: "",
    characterConfidence: "low",
  };
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
  style?: { color?: string; alpha?: number; lineWidth?: number },
) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = style?.color ?? "#17233b";
  ctx.globalAlpha = style?.alpha ?? 1;
  ctx.lineWidth = style?.lineWidth ?? (stroke.pointerType === "pen" ? 3.2 : 4.2);
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);

  if (stroke.points.length === 1) {
    ctx.lineTo(stroke.points[0].x * width + 0.01, stroke.points[0].y * height + 0.01);
  } else {
    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const current = stroke.points[index];
      const next = stroke.points[index + 1];
      const midpointX = ((current.x + next.x) / 2) * width;
      const midpointY = ((current.y + next.y) / 2) * height;
      ctx.quadraticCurveTo(current.x * width, current.y * height, midpointX, midpointY);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

function renderAnalysisSheet(samples: Sample[]) {
  const canvas = document.createElement("canvas");
  const width = 1280;
  const height = 900;
  const bandHeight = 280;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#fffefa";
  ctx.fillRect(0, 0, width, height);
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  samples.slice(0, 3).forEach((sample, index) => {
    const top = index * 300;
    ctx.fillStyle = index % 2 === 0 ? "#fffefa" : "#faf7f0";
    ctx.fillRect(0, top, width, 300);
    ctx.strokeStyle = "rgba(69, 98, 134, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, top + 205);
    ctx.lineTo(width - 35, top + 205);
    ctx.stroke();

    ctx.fillStyle = OVERLAY_COLORS[index];
    ctx.beginPath();
    ctx.arc(35, top + 150, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(index + 1), 35, top + 151);

    ctx.save();
    ctx.translate(70, top + 20);
    sample.strokes.forEach((stroke) =>
      drawStroke(ctx, stroke, width - 110, bandHeight - 35, {
        color: "#17233b",
        alpha: 1,
        lineWidth: stroke.pointerType === "pen" ? 4.5 : 5.5,
      }),
    );
    ctx.restore();
  });

  return canvas.toDataURL("image/jpeg", 0.82);
}

function findVarianceHotspot(samples: Sample[]) {
  const paths = samples.map((sample) => sample.strokes.flatMap((stroke) => stroke.points));
  let hotspot = { x: 0.5, y: 0.5, spread: 0 };

  for (let step = 0; step <= 32; step += 1) {
    const progress = step / 32;
    const points = paths
      .filter((path) => path.length)
      .map((path) => path[Math.min(path.length - 1, Math.round(progress * (path.length - 1)))]);
    if (points.length < 2) continue;
    const centerX = mean(points.map((point) => point.x));
    const centerY = mean(points.map((point) => point.y));
    const spread = mean(points.map((point) => Math.hypot(point.x - centerX, point.y - centerY)));
    if (spread > hotspot.spread) hotspot = { x: centerX, y: centerY, spread };
  }

  return hotspot;
}

function scorePracticeSample(sample: Sample, summary: AnalysisSummary) {
  const metric = measureSample(sample);
  const targetRhythm = mean(summary.samples.map((item) => item.rhythm));
  const targetShape = summary.averages.width / Math.max(summary.averages.height, 0.01);
  const sampleShape = metric.width / Math.max(metric.height, 0.01);
  const deviations = {
    size:
      Math.abs(
        Math.sqrt(metric.area) - Math.sqrt(summary.averages.width * summary.averages.height),
      ) / Math.max(Math.sqrt(summary.averages.width * summary.averages.height), 0.01),
    speed: Math.abs(metric.speed - summary.averages.speed) / Math.max(summary.averages.speed, 0.01),
    stroke:
      Math.abs(metric.strokeCount - summary.averages.strokeCount) /
      Math.max(summary.averages.strokeCount, 1),
    rhythm: Math.abs(metric.rhythm - targetRhythm) / Math.max(targetRhythm, 0.08),
    shape: Math.abs(sampleShape - targetShape) / Math.max(targetShape, 0.01),
  };
  const overall = mean(Object.values(deviations).map((value) => Math.min(value, 1)));
  const focused = Math.min(deviations[summary.focusKey], 1);
  return Math.round(clamp(97 - focused * 48 - overall * 30, 42, 98));
}

function beautifySample(sample: Sample, styleKey: BeautyStyleKey, identity: number, prompt: string): Sample {
  const allPoints = sample.strokes.flatMap((stroke) => stroke.points);
  if (!allPoints.length) return sample;
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const strength = clamp((100 - identity) / 45, 0.22, 1.18);
  const style = {
    neat: { smoothing: 0.76, width: 0.98, height: 1, shear: 0, curve: -0.42, align: 0.9 },
    round: { smoothing: 0.82, width: 1.07, height: 1.08, shear: -0.018, curve: 0.48, align: 0.68 },
    flow: { smoothing: 0.64, width: 1.08, height: 0.94, shear: -0.16, curve: 0.16, align: 0.5 },
  }[styleKey];

  const promptUnits = Array.from(prompt).map((character) => ({
    character,
    width: /\s/.test(character) ? 0.62 : /[.,!?·]/.test(character) ? 0.42 : 1,
  }));
  const totalPromptWidth = promptUnits.reduce((sum, unit) => sum + unit.width, 0);
  let promptCursor = 0;
  const slots = promptUnits.flatMap((unit) => {
    const center = promptCursor + unit.width / 2;
    promptCursor += unit.width;
    return /[가-힣]/.test(unit.character)
      ? [minX + (center / Math.max(totalPromptWidth, 1)) * (maxX - minX)]
      : [];
  });

  const strokeBounds = sample.strokes.map((stroke) => {
    const xs = stroke.points.map((point) => point.x);
    const ys = stroke.points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    };
  });
  const groups = slots.map((targetCenterX) => ({ targetCenterX, strokeIndexes: [] as number[] }));
  strokeBounds.forEach((bounds, strokeIndex) => {
    if (!groups.length) return;
    let closestIndex = 0;
    for (let index = 1; index < groups.length; index += 1) {
      if (
        Math.abs(groups[index].targetCenterX - bounds.centerX) <
        Math.abs(groups[closestIndex].targetCenterX - bounds.centerX)
      ) closestIndex = index;
    }
    groups[closestIndex].strokeIndexes.push(strokeIndex);
  });

  const populatedGroups = groups
    .filter((group) => group.strokeIndexes.length)
    .map((group) => {
      const bounds = group.strokeIndexes.map((index) => strokeBounds[index]);
      const groupMinX = Math.min(...bounds.map((item) => item.minX));
      const groupMaxX = Math.max(...bounds.map((item) => item.maxX));
      const groupMinY = Math.min(...bounds.map((item) => item.minY));
      const groupMaxY = Math.max(...bounds.map((item) => item.maxY));
      return {
        ...group,
        minX: groupMinX,
        maxX: groupMaxX,
        minY: groupMinY,
        maxY: groupMaxY,
        centerX: (groupMinX + groupMaxX) / 2,
        centerY: (groupMinY + groupMaxY) / 2,
        width: Math.max(groupMaxX - groupMinX, 0.012),
        height: Math.max(groupMaxY - groupMinY, 0.012),
      };
    });
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : mean([sorted[middle - 1], sorted[middle]]);
  };
  const targetWidth = median(populatedGroups.map((group) => group.width));
  const targetHeight = median(populatedGroups.map((group) => group.height));
  const targetBaseline = median(populatedGroups.map((group) => group.maxY));
  const groupByStroke = new Map<number, (typeof populatedGroups)[number]>();
  populatedGroups.forEach((group) => group.strokeIndexes.forEach((index) => groupByStroke.set(index, group)));

  return {
    ...sample,
    strokes: sample.strokes.map((stroke, strokeIndex) => {
      const first = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1] ?? first;
      const group = groupByStroke.get(strokeIndex);
      const groupCenterX = group?.centerX ?? (minX + maxX) / 2;
      const groupCenterY = group?.centerY ?? (minY + maxY) / 2;
      const groupScaleX = group ? clamp(targetWidth / group.width, 0.78, 1.22) * style.width : style.width;
      const groupScaleY = group ? clamp(targetHeight / group.height, 0.8, 1.2) * style.height : style.height;
      const shiftX = group
        ? clamp((group.targetCenterX - group.centerX) * style.align, -0.038, 0.038)
        : 0;
      const targetCenterY = targetBaseline - targetHeight / 2;
      const shiftY = group ? clamp((targetCenterY - group.centerY) * style.align, -0.055, 0.055) : 0;
      return {
        ...stroke,
        points: stroke.points.map((point, index, points) => {
          const from = Math.max(0, index - 2);
          const to = Math.min(points.length - 1, index + 2);
          const neighbors = points.slice(from, to + 1);
          const localX = mean(neighbors.map((item) => item.x));
          const localY = mean(neighbors.map((item) => item.y));
          const smoothX = point.x + (localX - point.x) * style.smoothing;
          const smoothY = point.y + (localY - point.y) * style.smoothing;
          const progress = points.length > 1 ? index / (points.length - 1) : 0;
          const chordX = first.x + (last.x - first.x) * progress;
          const chordY = first.y + (last.y - first.y) * progress;
          const deltaX = Math.abs(last.x - first.x);
          const deltaY = Math.abs(last.y - first.y);
          const axisStroke = deltaX > deltaY * 1.7 || deltaY > deltaX * 1.7;
          const curve = styleKey === "neat" && !axisStroke ? style.curve * 0.45 : style.curve;
          const curvedX = chordX + (smoothX - chordX) * (1 + curve);
          const curvedY = chordY + (smoothY - chordY) * (1 + curve);
          const scaledX = groupCenterX + (curvedX - groupCenterX) * groupScaleX;
          const scaledY = groupCenterY + (curvedY - groupCenterY) * groupScaleY;
          const styledX = scaledX + (scaledY - groupCenterY) * style.shear + shiftX;
          const styledY = scaledY + shiftY;
          return {
            ...point,
            x: clamp(point.x + (styledX - point.x) * strength, 0.015, 0.985),
            y: clamp(point.y + (styledY - point.y) * strength, 0.025, 0.975),
          };
        }),
      };
    }),
  };
}

function measureCorrectionDistance(source: Sample, corrected: Sample) {
  const distances: number[] = [];
  const strokeCount = Math.min(source.strokes.length, corrected.strokes.length);
  for (let index = 0; index < strokeCount; index += 1) {
    const sourcePoints = resampleStroke(source.strokes[index], 18);
    const correctedPoints = resampleStroke(corrected.strokes[index], 18);
    sourcePoints.forEach((point, pointIndex) => {
      const correctedPoint = correctedPoints[pointIndex];
      if (correctedPoint) distances.push(Math.hypot(point.x - correctedPoint.x, point.y - correctedPoint.y));
    });
  }
  return Math.max(1, Math.round(mean(distances) * 900));
}

function resampleStroke(stroke: Stroke, count = 14) {
  if (!stroke.points.length) return [];
  return Array.from({ length: count }, (_, index) => {
    const position = (index / Math.max(count - 1, 1)) * (stroke.points.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(stroke.points.length - 1, Math.ceil(position));
    const mix = position - lower;
    const a = stroke.points[lower];
    const b = stroke.points[upper];
    return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix };
  });
}

function scoreAgainstTarget(sample: Sample, target: Sample) {
  const pairedCount = Math.min(sample.strokes.length, target.strokes.length);
  const distances: number[] = [];
  for (let index = 0; index < pairedCount; index += 1) {
    const attemptPoints = resampleStroke(sample.strokes[index]);
    const targetPoints = resampleStroke(target.strokes[index]);
    attemptPoints.forEach((point, pointIndex) => {
      const targetPoint = targetPoints[pointIndex];
      if (targetPoint) distances.push(Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y));
    });
  }
  const shapeDistance = distances.length ? mean(distances) : 0.4;
  const strokePenalty =
    Math.abs(sample.strokes.length - target.strokes.length) / Math.max(target.strokes.length, 1);
  const sampleMetric = measureSample(sample);
  const targetMetric = measureSample(target);
  const proportionPenalty =
    Math.abs(sampleMetric.width - targetMetric.width) + Math.abs(sampleMetric.height - targetMetric.height);
  return Math.round(clamp(100 - shapeDistance * 360 - strokePenalty * 34 - proportionPenalty * 42, 38, 99));
}

const OVERLAY_COLORS = ["#ed735f", "#5aa985", "#17233b"];

function StrokeOverlay({ samples, focusLabel, variation }: { samples: Sample[]; focusLabel: string; variation: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(1);
  const hotspot = useMemo(() => findVarianceHotspot(samples), [samples]);

  const renderFrame = useCallback(
    (frameProgress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);

      samples.forEach((sample, sampleIndex) => {
        const totalPoints = sample.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
        let remaining = Math.floor(totalPoints * frameProgress);
        sample.strokes.forEach((stroke) => {
          if (remaining <= 0) return;
          const visibleCount = Math.min(stroke.points.length, remaining);
          if (visibleCount > 0) {
            drawStroke(
              ctx,
              { ...stroke, points: stroke.points.slice(0, visibleCount) },
              rect.width,
              rect.height,
              { color: OVERLAY_COLORS[sampleIndex], alpha: 0.66, lineWidth: 3.4 },
            );
          }
          remaining -= stroke.points.length;
        });
      });

      if (frameProgress >= 0.98) {
        const x = hotspot.x * rect.width;
        const y = hotspot.y * rect.height;
        const radius = clamp(hotspot.spread * Math.min(rect.width, rect.height) * 2.8, 18, 42);
        ctx.save();
        ctx.strokeStyle = "#ed735f";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(237, 115, 95, 0.1)";
        ctx.fill();
        ctx.restore();
      }
    },
    [hotspot, samples],
  );

  useEffect(() => {
    renderFrame(progress);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => renderFrame(progress));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [progress, renderFrame]);

  useEffect(
    () => () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    },
    [],
  );

  const replay = () => {
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    const startedAt = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 3000;
    setIsPlaying(true);
    setProgress(0);
    const tick = (now: number) => {
      const nextProgress = clamp((now - startedAt) / duration, 0, 1);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        animationRef.current = window.requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
        setIsPlaying(false);
      }
    };
    animationRef.current = window.requestAnimationFrame(tick);
  };

  const variationPercent = Math.round(clamp(variation * 140, 8, 64));

  return (
    <div className="overlay-panel">
      <div className="overlay-heading">
        <div>
          <p className="section-kicker">3-WAY MOTION OVERLAY</p>
          <h3>세 번의 필기를 한 장에 겹쳤어요</h3>
        </div>
        <button className="replay-button" type="button" onClick={replay} disabled={isPlaying}>
          <span aria-hidden="true">{isPlaying ? "•••" : "▶"}</span>
          {isPlaying ? "재생 중" : "획순 다시 보기"}
        </button>
      </div>
      <div className="overlay-paper">
        <canvas ref={canvasRef} aria-label="세 번의 필기 움직임 오버레이" />
        <div className="overlay-legend" aria-hidden="true">
          {OVERLAY_COLORS.map((color, index) => (
            <span key={color}><i style={{ background: color }} />{index + 1}번째</span>
          ))}
        </div>
      </div>
      <div className="hotspot-caption">
        <span className="hotspot-icon">◎</span>
        <p><strong>가장 많이 달라진 구간</strong><br />{focusLabel} 변화가 약 {variationPercent}% 감지됐어요.</p>
      </div>
    </div>
  );
}

function getHangulCharacters(prompt: string, preferred?: string) {
  const preferredCharacter = Array.from(preferred ?? "").find((character) => /[가-힣]/.test(character));
  const characters = Array.from(prompt).filter((character) => /[가-힣]/.test(character));
  return Array.from(new Set([...(preferredCharacter ? [preferredCharacter] : []), ...characters])).slice(0, 18);
}

function drawSpeedHeatmap(
  ctx: CanvasRenderingContext2D,
  sample: Sample,
  width: number,
  height: number,
  progress: number,
) {
  const segments = sample.strokes.flatMap((stroke) =>
    stroke.points.slice(1).map((point, index) => {
      const previous = stroke.points[index];
      const elapsed = Math.max(point.t - previous.t, 1);
      return pointDistance(previous, point) / elapsed;
    }),
  );
  const sorted = [...segments].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.12)] ?? 0;
  const high = sorted[Math.floor(sorted.length * 0.88)] ?? Math.max(...segments, 0.001);
  const totalPoints = sample.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  let remaining = Math.max(1, Math.floor(totalPoints * progress));

  sample.strokes.forEach((stroke, strokeIndex) => {
    if (remaining <= 0 || !stroke.points.length) return;
    const visibleCount = Math.min(stroke.points.length, remaining);
    const visiblePoints = stroke.points.slice(0, visibleCount);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.pointerType === "pen" ? 5.5 : 7;
    for (let index = 1; index < visiblePoints.length; index += 1) {
      const previous = visiblePoints[index - 1];
      const point = visiblePoints[index];
      const elapsed = Math.max(point.t - previous.t, 1);
      const speed = pointDistance(previous, point) / elapsed;
      const normalized = clamp((speed - low) / Math.max(high - low, 0.00001), 0, 1);
      const hue = 210 - normalized * 202;
      ctx.strokeStyle = `hsl(${hue} 76% 48%)`;
      ctx.beginPath();
      ctx.moveTo(previous.x * width, previous.y * height);
      ctx.lineTo(point.x * width, point.y * height);
      ctx.stroke();
    }

    if (visiblePoints.length) {
      const first = visiblePoints[0];
      const x = first.x * width;
      const y = first.y * height;
      ctx.fillStyle = "#fffefa";
      ctx.strokeStyle = "#17233b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#17233b";
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(strokeIndex + 1), x, y + 0.5);
    }
    ctx.restore();
    remaining -= stroke.points.length;
  });
}

function CharacterHeatmap({ samples, character }: { samples: Sample[]; character: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, samples.length - 1));
  const [progress, setProgress] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const sample = samples[activeIndex] ?? samples[0];

  const renderFrame = useCallback(
    (frameProgress: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !sample) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      drawSpeedHeatmap(ctx, sample, rect.width, rect.height, frameProgress);
    },
    [sample],
  );

  useEffect(() => {
    renderFrame(progress);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => renderFrame(progress));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [progress, renderFrame]);

  useEffect(
    () => () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    },
    [],
  );

  const selectSample = (index: number) => {
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    setIsPlaying(false);
    setProgress(1);
    setActiveIndex(index);
  };

  const replay = () => {
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    const startedAt = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 2200;
    setIsPlaying(true);
    setProgress(0);
    const tick = (now: number) => {
      const nextProgress = clamp((now - startedAt) / duration, 0, 1);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        animationRef.current = window.requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
        setIsPlaying(false);
      }
    };
    animationRef.current = window.requestAnimationFrame(tick);
  };

  return (
    <div className="heatmap-panel">
      <div className="heatmap-toolbar">
        <div className="sample-tabs" aria-label={`${character} 필기 선택`}>
          {samples.map((_, index) => (
            <button className={activeIndex === index ? "active" : ""} type="button" onClick={() => selectSample(index)} key={index}>
              {index + 1}번째
            </button>
          ))}
        </div>
        <button className="replay-button" type="button" onClick={replay} disabled={isPlaying}>
          <span aria-hidden="true">{isPlaying ? "•••" : "▶"}</span>{isPlaying ? "재생 중" : "획순 재생"}
        </button>
      </div>
      <div className="heatmap-paper">
        <span className="character-watermark" aria-hidden="true">{character}</span>
        <canvas ref={canvasRef} aria-label={`${character} 속도 히트맵과 획순`} />
      </div>
      <div className="speed-legend">
        <span>천천히</span><i /><span>빠르게</span><b>원 안의 숫자는 획의 시작 순서예요</b>
      </div>
    </div>
  );
}

function SampleCanvas({
  sample,
  underlay,
  className,
  ariaLabel,
  color = "#17233b",
  alpha = 1,
}: {
  sample: Sample;
  underlay?: Sample;
  className?: string;
  ariaLabel: string;
  color?: string;
  alpha?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    underlay?.strokes.forEach((stroke) =>
      drawStroke(ctx, stroke, rect.width, rect.height, { color: "#8d8f8b", alpha: 0.18, lineWidth: 3.8 }),
    );
    sample.strokes.forEach((stroke) =>
      drawStroke(ctx, stroke, rect.width, rect.height, { color, alpha, lineWidth: underlay ? 5 : 4.2 }),
    );
  }, [alpha, color, sample, underlay]);

  useEffect(() => {
    render();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  return <canvas ref={canvasRef} className={className} aria-label={ariaLabel} />;
}

function StrokeThumbnail({ sample, label }: { sample: Sample; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    sample.strokes.forEach((stroke) => drawStroke(ctx, stroke, rect.width, rect.height));
  }, [sample]);

  return (
    <div className="sample-thumb">
      <span>{label}</span>
      <canvas ref={canvasRef} aria-label={`${label} 필기 결과`} />
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [phase, setPhase] = useState<
    | "write"
    | "analyzing"
    | "result"
    | "practice"
    | "character-practice"
    | "character-result"
    | "beautify"
    | "beauty-practice"
  >("write");
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"ai" | "local">("local");
  const [inputMode, setInputMode] = useState<"touch" | "pen" | "mouse" | null>(null);
  const [afterSample, setAfterSample] = useState<Sample | null>(null);
  const [afterScore, setAfterScore] = useState<number | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [characterSamples, setCharacterSamples] = useState<Sample[]>([]);
  const [characterSummary, setCharacterSummary] = useState<AnalysisSummary | null>(null);
  const [beautyStyle, setBeautyStyle] = useState<BeautyStyleKey>("neat");
  const [beautyIdentity, setBeautyIdentity] = useState(58);
  const [beautyPracticeScore, setBeautyPracticeScore] = useState<number | null>(null);

  const sampleNumber = samples.length + 1;
  const hasEnoughInk = useMemo(
    () => strokes.reduce((count, stroke) => count + stroke.points.length, 0) >= 8,
    [strokes],
  );
  const practiceCharacters = useMemo(
    () => getHangulCharacters(prompt, feedback?.characterTarget),
    [feedback?.characterTarget, prompt],
  );
  const characterAttemptScores = useMemo(
    () =>
      characterSummary && characterSamples.length === 3
        ? characterSamples.map((sample) => scorePracticeSample(sample, characterSummary))
        : [],
    [characterSamples, characterSummary],
  );
  const beautifiedSample = useMemo(
    () => (samples[2] ? beautifySample(samples[2], beautyStyle, beautyIdentity, prompt) : null),
    [beautyIdentity, beautyStyle, prompt, samples],
  );
  const beautyCorrectionDistance = useMemo(
    () => (samples[2] && beautifiedSample ? measureCorrectionDistance(samples[2], beautifiedSample) : 0),
    [beautifiedSample, samples],
  );
  const isDrawingPhase =
    phase === "write" || phase === "practice" || phase === "character-practice" || phase === "beauty-practice";

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, rect.width, rect.height));
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const eventPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const penPressure = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      t: Math.max(0, event.timeStamp - startTimeRef.current),
      pressure: penPressure,
      tiltX: event.pointerType === "pen" ? event.tiltX : null,
      tiltY: event.pointerType === "pen" ? event.tiltY : null,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingPhase || activePointerRef.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    startTimeRef.current = event.timeStamp;
    setInputMode(event.pointerType as "touch" | "pen" | "mouse");
    const nextStroke: Stroke = { pointerType: event.pointerType, points: [eventPoint(event)] };
    setStrokes((current) => [...current, nextStroke]);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId || !isDrawingPhase) return;
    event.preventDefault();
    const nativeEvent = event.nativeEvent;
    const coalesced = typeof nativeEvent.getCoalescedEvents === "function" ? nativeEvent.getCoalescedEvents() : [nativeEvent];
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPoints = coalesced.map((pointEvent) => ({
      x: clamp((pointEvent.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((pointEvent.clientY - rect.top) / rect.height, 0, 1),
      t: Math.max(0, pointEvent.timeStamp - startTimeRef.current),
      pressure: pointEvent.pointerType === "pen" && pointEvent.pressure > 0 ? pointEvent.pressure : null,
      tiltX: pointEvent.pointerType === "pen" ? pointEvent.tiltX : null,
      tiltY: pointEvent.pointerType === "pen" ? pointEvent.tiltY : null,
    }));
    setStrokes((current) => {
      if (!current.length) return current;
      const next = [...current];
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, points: [...last.points, ...nextPoints] };
      return next;
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetCanvas = () => {
    activePointerRef.current = null;
    setStrokes([]);
  };

  const submitSample = async () => {
    if (!hasEnoughInk) return;
    const currentSample: Sample = {
      strokes,
      pointerType: inputMode ?? "unknown",
    };
    const nextSamples = [...samples, currentSample];

    if (nextSamples.length < 3) {
      setSamples(nextSamples);
      resetCanvas();
      return;
    }

    const nextSummary = analyzeSamples(nextSamples);
    const fallback = buildFallbackFeedback(nextSummary);
    setSamples(nextSamples);
    setSummary(nextSummary);
    setFeedback(fallback);
    setPhase("analyzing");
    resetCanvas();

    const startedAt = Date.now();
    try {
      const analysisImage = renderAnalysisSheet(nextSamples);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, summary: nextSummary, fallback, analysisImage }),
      });
      if (response.ok) {
        const result = (await response.json()) as { mode?: "ai" | "local"; feedback?: Feedback };
        if (result.feedback) setFeedback(result.feedback);
        setAnalysisMode(result.mode === "ai" ? "ai" : "local");
      }
    } catch {
      setAnalysisMode("local");
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed < 900) await new Promise((resolve) => window.setTimeout(resolve, 900 - elapsed));
    setPhase("result");
  };

  const restart = () => {
    setSamples([]);
    setSummary(null);
    setFeedback(null);
    setAfterSample(null);
    setAfterScore(null);
    setSelectedCharacter("");
    setCharacterSamples([]);
    setCharacterSummary(null);
    setBeautyStyle("neat");
    setBeautyIdentity(58);
    setBeautyPracticeScore(null);
    setAnalysisMode("local");
    setInputMode(null);
    resetCanvas();
    setPhase("write");
  };

  const startPractice = () => {
    resetCanvas();
    setAfterSample(null);
    setAfterScore(null);
    setPhase("practice");
  };

  const submitPractice = () => {
    if (!hasEnoughInk || !summary) return;
    const practiceSample: Sample = { strokes, pointerType: inputMode ?? "unknown" };
    setAfterSample(practiceSample);
    setAfterScore(scorePracticeSample(practiceSample, summary));
    resetCanvas();
    setPhase("result");
  };

  const startCharacterPractice = () => {
    const character =
      Array.from(feedback?.characterTarget ?? "").find((item) => /[가-힣]/.test(item)) ??
      practiceCharacters[0] ??
      "가";
    setSelectedCharacter(character);
    setCharacterSamples([]);
    setCharacterSummary(null);
    resetCanvas();
    setPhase("character-practice");
  };

  const chooseCharacter = (character: string) => {
    if (characterSamples.length > 0) return;
    setSelectedCharacter(character);
    resetCanvas();
  };

  const submitCharacterSample = () => {
    if (!hasEnoughInk) return;
    const currentSample: Sample = { strokes, pointerType: inputMode ?? "unknown" };
    const nextSamples = [...characterSamples, currentSample];
    if (nextSamples.length < 3) {
      setCharacterSamples(nextSamples);
      resetCanvas();
      return;
    }
    setCharacterSamples(nextSamples);
    setCharacterSummary(analyzeSamples(nextSamples));
    resetCanvas();
    setPhase("character-result");
  };

  const repeatCharacterPractice = () => {
    setCharacterSamples([]);
    setCharacterSummary(null);
    resetCanvas();
    setPhase("character-practice");
  };

  const startBeautify = () => {
    setBeautyPracticeScore(null);
    resetCanvas();
    setPhase("beautify");
  };

  const startBeautyPractice = () => {
    setBeautyPracticeScore(null);
    resetCanvas();
    setPhase("beauty-practice");
  };

  const submitBeautyPractice = () => {
    if (!hasEnoughInk || !beautifiedSample) return;
    const practiceSample: Sample = { strokes, pointerType: inputMode ?? "unknown" };
    setBeautyPracticeScore(scoreAgainstTarget(practiceSample, beautifiedSample));
    resetCanvas();
    setPhase("beautify");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="글결 처음으로">
          <span className="brand-mark">ㄱ</span>
          <span>
            글결
            <small>GeulGyeol</small>
          </span>
        </a>
        <div className="device-note">
          <span className="live-dot" />
          {inputMode === "pen" ? "Apple Pencil 감지됨" : inputMode === "touch" ? "손가락 입력 감지됨" : "손가락 · Apple Pencil 모두 가능"}
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">나만의 한글 필체 코치</p>
          <h1>세 번 쓰면,<br /><em>고칠 한 가지</em>가 보여요.</h1>
        </div>
        <p className="hero-copy">
          글씨를 폰트처럼 바꾸지 않아요. 반복해서 흔들리는 습관만 찾아내고,
          당신다운 필체는 그대로 지켜드려요.
        </p>
      </section>

      <nav className="stepper" aria-label="분석 진행 단계">
        {["3번 쓰기", "움직임 분석", "한 가지 교정"].map((label, index) => {
          const activeIndex = phase === "write" ? 0 : phase === "analyzing" ? 1 : 2;
          return (
            <div className={index <= activeIndex ? "step active" : "step"} key={label}>
              <span>{index + 1}</span>
              {label}
            </div>
          );
        })}
      </nav>

      {phase === "write" && (
        <section className="workspace-card writing-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">SAMPLE {sampleNumber} / 3</p>
              <h2>아래 문장을 평소처럼 써 주세요</h2>
            </div>
            <div className="sample-dots" aria-label={`${sampleNumber}번째 필기 중`}>
              {[0, 1, 2].map((index) => (
                <span className={index < samples.length ? "done" : index === samples.length ? "current" : ""} key={index} />
              ))}
            </div>
          </div>

          <div className="prompt-row">
            <div className="quote-mark">“</div>
            <p>{prompt}</p>
            <label>
              <span className="sr-only">연습 문장 선택</span>
              <select value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={samples.length > 0}>
                {PROMPTS.map((item, index) => (
                  <option value={item} key={item}>문장 {index + 1}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="paper-wrap">
            <div className="paper-label">
              <span>{inputMode === "pen" ? "Pencil mode" : inputMode === "touch" ? "Finger mode" : "Write here"}</span>
              <span>손바닥이 닿아도 한 번에 하나의 입력만 기록해요</span>
            </div>
            <canvas
              ref={canvasRef}
              className="writing-canvas"
              aria-label="한글 필기 입력 영역"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!strokes.length && (
              <div className="canvas-hint" aria-hidden="true">
                <span>손가락이나 펜으로 이곳에 써 보세요</span>
              </div>
            )}
          </div>

          <div className="canvas-actions">
            <div>
              <button className="quiet-button" type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={!strokes.length}>
                한 획 지우기
              </button>
              <button className="quiet-button" type="button" onClick={resetCanvas} disabled={!strokes.length}>
                모두 지우기
              </button>
            </div>
            <button className="primary-button" type="button" onClick={submitSample} disabled={!hasEnoughInk}>
              {sampleNumber < 3 ? `${sampleNumber}번째 글씨 저장` : "세 글씨 비교하기"}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="privacy-note">
            <span>✓</span>
            원본 획은 저장하지 않으며, AI 연결 시 축소된 비교 이미지와 요약값만 분석해요.
          </div>
        </section>
      )}

      {phase === "analyzing" && (
        <section className="workspace-card analyzing-card" aria-live="polite">
          <div className="analysis-orbit">
            <span /><span /><span />
            <strong>ㄱ</strong>
          </div>
          <p className="section-kicker">MOTION ANALYSIS</p>
          <h2>세 번의 움직임을 겹쳐 보고 있어요</h2>
          <p>글자 크기, 쓰는 속도, 획의 리듬 중 가장 많이 흔들리는 한 가지를 찾습니다.</p>
          <div className="scan-list">
            <span>크기 일관성</span><span>속도 변화</span><span>획 리듬</span><span>문장 균형</span>
          </div>
        </section>
      )}

      {phase === "practice" && summary && feedback && (
        <section className="workspace-card writing-card practice-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">CORRECTION ROUND</p>
              <h2>교정 포인트를 생각하며 한 번 더 써 보세요</h2>
            </div>
            <div className="practice-score-chip">교정 전 {summary.consistency}점</div>
          </div>

          <div className="practice-focus-strip">
            <span>오늘의 초점 · {summary.focusLabel}</span>
            <strong>{feedback.tip}</strong>
          </div>

          <div className="prompt-row practice-prompt">
            <div className="quote-mark">“</div>
            <p>{prompt}</p>
          </div>

          <div className="paper-wrap">
            <div className="paper-label">
              <span>{inputMode === "pen" ? "Pencil mode" : inputMode === "touch" ? "Finger mode" : "Correction round"}</span>
              <span>방금 본 한 가지 포인트에만 집중해 보세요</span>
            </div>
            <canvas
              ref={canvasRef}
              className="writing-canvas"
              aria-label="교정 후 한글 필기 입력 영역"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!strokes.length && (
              <div className="canvas-hint" aria-hidden="true">
                <span>같은 문장을 다시 써 보세요</span>
              </div>
            )}
          </div>

          <div className="canvas-actions">
            <div>
              <button className="quiet-button" type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={!strokes.length}>
                한 획 지우기
              </button>
              <button className="quiet-button" type="button" onClick={resetCanvas} disabled={!strokes.length}>
                모두 지우기
              </button>
            </div>
            <button className="primary-button" type="button" onClick={submitPractice} disabled={!hasEnoughInk}>
              교정 후 점수 확인 <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}

      {phase === "beautify" && beautifiedSample && samples[2] && (
        <section className="workspace-card beauty-studio-card">
          <div className="beauty-studio-heading">
            <div>
              <p className="section-kicker">MY BEAUTIFUL HANDWRITING</p>
              <h2>내 글씨의 예쁜 가능성을 만들었어요</h2>
              <p>폰트로 바꾸지 않고, 내가 쓴 획의 {beautyIdentity}%는 남긴 채 글자별 기준선·높이·간격과 획의 모양을 함께 다듬어요.</p>
            </div>
            <button className="restart-link inline" type="button" onClick={() => setPhase("result")}>분석 결과로 돌아가기</button>
          </div>

          <div className="beauty-style-section">
            <div className="beauty-section-title">
              <span>1. 원하는 느낌 선택</span>
              <small>스타일을 바꿔도 원래 획순과 글씨의 중심은 유지돼요</small>
            </div>
            <div className="beauty-style-grid">
              {(Object.entries(BEAUTY_STYLES) as [BeautyStyleKey, (typeof BEAUTY_STYLES)[BeautyStyleKey]][]).map(([key, style]) => (
                <button
                  className={beautyStyle === key ? "beauty-style-card selected" : "beauty-style-card"}
                  type="button"
                  onClick={() => {
                    setBeautyStyle(key);
                    setBeautyPracticeScore(null);
                  }}
                  key={key}
                >
                  <span className="beauty-style-mark" aria-hidden="true">{style.mark}</span>
                  <span><b>{style.name}</b><small>{style.english}</small><em>{style.description}</em></span>
                  <i aria-hidden="true">{beautyStyle === key ? "✓" : ""}</i>
                </button>
              ))}
            </div>
          </div>

          <div className="beauty-identity-control">
            <div>
              <span>2. 내 글씨다움</span>
              <strong>{beautyIdentity}% 유지 · {beautyIdentity <= 55 ? "확실한 교정" : beautyIdentity <= 70 ? "균형 교정" : "섬세한 교정"}</strong>
            </div>
            <input
              type="range"
              min="40"
              max="90"
              step="1"
              value={beautyIdentity}
              aria-label="원래 필체 유지 비율"
              onChange={(event) => {
                setBeautyIdentity(Number(event.target.value));
                setBeautyPracticeScore(null);
              }}
              style={{ "--identity": `${((beautyIdentity - 40) / 50) * 100}%` } as React.CSSProperties}
            />
            <div className="beauty-identity-labels"><span>확실하게 교정</span><span>원래 필체 유지</span></div>
          </div>

          <div className="beauty-preview-grid">
            <div className="beauty-preview-card before">
              <div><span>BEFORE</span><strong>내가 쓴 원본</strong></div>
              <div className="beauty-preview-paper">
                <SampleCanvas sample={samples[2]} ariaLabel="사용자가 쓴 원본 글씨" />
              </div>
            </div>
            <div className="beauty-preview-arrow" aria-hidden="true"><span>✦</span><b>AI<br />STYLING</b></div>
            <div className="beauty-preview-card after">
              <div><span>AFTER</span><strong>{BEAUTY_STYLES[beautyStyle].name}</strong><em className="beauty-distance-badge">평균 {beautyCorrectionDistance}px 보정</em></div>
              <div className="beauty-preview-paper">
                <SampleCanvas
                  sample={beautifiedSample}
                  underlay={samples[2]}
                  color="#ed735f"
                  ariaLabel={`${BEAUTY_STYLES[beautyStyle].name}로 교정된 글씨`}
                />
              </div>
            </div>
          </div>

          <div className="beauty-change-row">
            <span>이번 보정</span>
            {BEAUTY_STYLES[beautyStyle].changes.map((change) => <b key={change}>✓ {change}</b>)}
            <small>회색 선은 원본, 산호색 선은 교정된 획이에요</small>
          </div>

          {beautyPracticeScore !== null && (
            <div className="beauty-practice-result" aria-live="polite">
              <div className="beauty-match-score"><strong>{beautyPracticeScore}</strong><span>%<br />가이드 유사도</span></div>
              <div>
                <p className="section-kicker">TRACE RESULT</p>
                <h3>{beautyPracticeScore >= 78 ? "교정된 리듬이 손에 잘 익었어요" : "모양보다 획의 흐름을 한 번 더 따라가 보세요"}</h3>
                <p>{beautyPracticeScore >= 78 ? "원래 필체는 남아 있으면서 정돈된 획의 위치와 비율에 가까워졌어요." : "점수를 맞추기보다 흐린 선이 시작하고 끝나는 위치에 집중하면 더 자연스럽게 익힐 수 있어요."}</p>
              </div>
            </div>
          )}

          <div className="beauty-studio-actions">
            <button className="primary-button beauty-primary" type="button" onClick={startBeautyPractice}>
              {beautyPracticeScore === null ? "교정된 내 글씨 따라 써보기" : "한 번 더 따라 써보기"}<span aria-hidden="true">→</span>
            </button>
            <button className="quiet-outline-button" type="button" onClick={() => setPhase("result")}>이 스타일로 정하고 돌아가기</button>
          </div>
        </section>
      )}

      {phase === "beauty-practice" && beautifiedSample && (
        <section className="workspace-card writing-card beauty-trace-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">TRACE MY BETTER STYLE</p>
              <h2>예뻐진 내 획의 흐름을 따라가 보세요</h2>
            </div>
            <div className="beauty-trace-chip">{BEAUTY_STYLES[beautyStyle].name} · {beautyIdentity}% 나다움</div>
          </div>

          <div className="beauty-trace-guide">
            <span>연습 방법</span>
            <strong>산호색 선 위를 천천히 따라 쓰되, 원래 쓰던 획순은 그대로 유지하세요.</strong>
          </div>

          <div className="prompt-row beauty-trace-prompt">
            <div className="quote-mark">“</div>
            <p>{prompt}</p>
          </div>

          <div className="paper-wrap beauty-trace-paper">
            <div className="paper-label">
              <span>{inputMode === "pen" ? "Pencil mode" : inputMode === "touch" ? "Finger mode" : "Trace guide"}</span>
              <span>산호색은 가이드 · 진한 남색은 지금 쓰는 획</span>
            </div>
            <SampleCanvas
              sample={beautifiedSample}
              className="beauty-guide-canvas"
              color="#ed735f"
              alpha={0.28}
              ariaLabel="교정된 글씨 따라쓰기 가이드"
            />
            <canvas
              ref={canvasRef}
              className="writing-canvas beauty-input-canvas"
              aria-label="교정된 내 글씨 따라 쓰기 영역"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!strokes.length && (
              <div className="canvas-hint beauty-canvas-hint" aria-hidden="true"><span>흐린 획 위에 그대로 써 보세요</span></div>
            )}
          </div>

          <div className="canvas-actions">
            <div>
              <button className="quiet-button" type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={!strokes.length}>한 획 지우기</button>
              <button className="quiet-button" type="button" onClick={resetCanvas} disabled={!strokes.length}>모두 지우기</button>
            </div>
            <button className="primary-button" type="button" onClick={submitBeautyPractice} disabled={!hasEnoughInk}>
              가이드 유사도 확인 <span aria-hidden="true">→</span>
            </button>
          </div>
          <button className="restart-link" type="button" onClick={() => { resetCanvas(); setPhase("beautify"); }}>스타일 선택으로 돌아가기</button>
        </section>
      )}

      {phase === "character-practice" && (
        <section className="workspace-card writing-card character-practice-card">
          <div className="card-heading character-lab-heading">
            <div>
              <p className="section-kicker">FOCUS CHARACTER LAB</p>
              <h2>한 글자 집중 연습실</h2>
            </div>
            <div className="character-progress-chip">{characterSamples.length + 1} / 3</div>
          </div>

          <div className="character-picker-block">
            <div className="character-picker-title">
              <span>연습할 글자</span>
              <small>{characterSamples.length ? "3번을 마칠 때까지 같은 글자를 써요" : "문장 속 글자를 직접 고를 수 있어요"}</small>
            </div>
            <div className="character-picker" aria-label="연습할 한글 선택">
              {practiceCharacters.map((character, index) => (
                <button
                  className={selectedCharacter === character ? "selected" : ""}
                  type="button"
                  onClick={() => chooseCharacter(character)}
                  disabled={characterSamples.length > 0 && selectedCharacter !== character}
                  key={character}
                >
                  {character}
                  {index === 0 && feedback?.characterTarget?.includes(character) && <span>AI</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="character-instruction">
            <span className="character-target-mini">{selectedCharacter}</span>
            <div>
              <strong>평소 쓰는 획순으로 크게 써 보세요</strong>
              <p>빠르게 잘 쓰려 하지 말고, 펜이 어디서 시작하고 얼마나 머무는지 그대로 기록해요.</p>
            </div>
          </div>

          <div className="character-paper">
            <span className="character-watermark" aria-hidden="true">{selectedCharacter}</span>
            <div className="paper-label">
              <span>{inputMode === "pen" ? "Pencil mode" : inputMode === "touch" ? "Finger mode" : "Write large"}</span>
              <span>{characterSamples.length + 1}번째 시도 · 화면 안에 한 글자만 크게</span>
            </div>
            <canvas
              ref={canvasRef}
              className="writing-canvas character-canvas"
              aria-label={`${selectedCharacter} 한 글자 필기 입력 영역`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!strokes.length && (
              <div className="canvas-hint character-canvas-hint" aria-hidden="true">
                <span>{selectedCharacter} 한 글자를 써 보세요</span>
              </div>
            )}
          </div>

          <div className="canvas-actions character-actions">
            <div>
              <button className="quiet-button" type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={!strokes.length}>
                한 획 지우기
              </button>
              <button className="quiet-button" type="button" onClick={resetCanvas} disabled={!strokes.length}>
                모두 지우기
              </button>
            </div>
            <button className="primary-button" type="button" onClick={submitCharacterSample} disabled={!hasEnoughInk || !selectedCharacter}>
              {characterSamples.length < 2 ? `${characterSamples.length + 1}번째 글자 저장` : "속도 히트맵 분석하기"}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="privacy-note">
            <span>✓</span>
            획의 좌표·시간·압력은 이 분석 화면에서만 사용하고 따로 저장하지 않아요.
          </div>
        </section>
      )}

      {phase === "character-result" && characterSummary && characterSamples.length === 3 && (
        <section className="workspace-card character-result-card">
          <div className="character-result-hero">
            <div className="character-result-mark" aria-hidden="true">{selectedCharacter}</div>
            <div>
              <p className="section-kicker">CHARACTER MOTION RESULT</p>
              <h2>“{selectedCharacter}”의 획 리듬을 분석했어요</h2>
              <p>탭을 눌러 세 번의 글씨를 비교하고, 재생 버튼으로 획의 시작 순서와 속도 변화를 확인하세요.</p>
            </div>
            <div className="mini-score-ring" style={{ "--score": characterSummary.consistency } as React.CSSProperties}>
              <div><strong>{characterSummary.consistency}</strong><span>안정성</span></div>
            </div>
          </div>

          <div className="character-result-grid">
            <CharacterHeatmap samples={characterSamples} character={selectedCharacter} />
            <aside className="character-result-insight">
              <p className="section-kicker">FIRST → THIRD</p>
              <h3>세 번째 글씨는 얼마나 안정됐을까요?</h3>
              <div className="character-score-change">
                <div><span>1번째</span><strong>{characterAttemptScores[0] ?? 0}<small>점</small></strong></div>
                <b aria-hidden="true">→</b>
                <div className="latest"><span>3번째</span><strong>{characterAttemptScores[2] ?? 0}<small>점</small></strong></div>
              </div>
              <p className={characterAttemptScores[2] >= characterAttemptScores[0] ? "character-delta up" : "character-delta"}>
                {characterAttemptScores[2] >= characterAttemptScores[0] ? "+" : ""}
                {(characterAttemptScores[2] ?? 0) - (characterAttemptScores[0] ?? 0)}점 변화
              </p>

              <div className="character-stat-grid">
                <div><span>평균 획 수</span><strong>{Math.round(characterSummary.averages.strokeCount)}획</strong></div>
                <div><span>속도 안정성</span><strong>{Math.round(clamp(100 - characterSummary.variations.speed * 180, 34, 98))}</strong></div>
                <div><span>리듬 안정성</span><strong>{Math.round(clamp(100 - characterSummary.variations.rhythm * 180, 34, 98))}</strong></div>
              </div>

              <div className="character-result-tip">
                <span>오늘의 초점 · {characterSummary.focusLabel}</span>
                <strong>{FOCUS_COPY[characterSummary.focusKey].tip}</strong>
              </div>
            </aside>
          </div>

          <div className="character-result-actions">
            <button className="primary-button" type="button" onClick={repeatCharacterPractice}>같은 글자 다시 연습</button>
            <button className="quiet-outline-button" type="button" onClick={repeatCharacterPractice}>다른 글자 선택</button>
            <button className="restart-link inline" type="button" onClick={() => setPhase("result")}>문장 분석 결과로 돌아가기</button>
          </div>
        </section>
      )}

      {phase === "result" && summary && feedback && (
        <section className="result-layout">
          <div className="workspace-card score-card">
            <div className="result-topline">
              <p className="section-kicker">YOUR HANDWRITING RHYTHM</p>
              <span className="analysis-badge">{analysisMode === "ai" ? "GPT-5.6 비전 코칭" : "기기 내 코칭"}</span>
            </div>
            <div className="score-row">
              <div className="score-ring" style={{ "--score": afterScore ?? summary.consistency } as React.CSSProperties}>
                <div><strong>{afterScore ?? summary.consistency}</strong><span>/ 100</span></div>
              </div>
              <div>
                <h2>
                  {afterScore !== null ? "교정 포인트를 적용한 글씨가" : "당신의 필체는 이미"}<br />
                  <em>
                    {afterScore !== null
                      ? afterScore > summary.consistency
                        ? "더 안정적으로 변했어요"
                        : "새 리듬을 익히는 중이에요"
                      : summary.consistency >= 82
                        ? "한결같은 편"
                        : "좋은 흐름을 가진 편"}
                  </em>
                  {afterScore === null && "이에요."}
                </h2>
                <p>
                  {afterScore !== null
                    ? afterScore > summary.consistency
                      ? `${summary.focusLabel}에 집중한 결과, 처음보다 ${afterScore - summary.consistency}점 더 안정적으로 측정됐어요.`
                      : "한 번에 바뀌지 않아도 괜찮아요. 교정 포인트를 의식한 것부터 좋은 시작이에요."
                    : feedback.keep}
                </p>
              </div>
            </div>

            <StrokeOverlay
              samples={samples}
              focusLabel={summary.focusLabel}
              variation={summary.variations[summary.focusKey]}
            />

            {afterSample && afterScore !== null && (
              <div className="improvement-panel">
                <div className="improvement-heading">
                  <div>
                    <p className="section-kicker">BEFORE &amp; AFTER</p>
                    <h3>한 번의 집중이 만든 변화</h3>
                  </div>
                  <span className={afterScore >= summary.consistency ? "score-delta up" : "score-delta"}>
                    {afterScore >= summary.consistency ? "+" : ""}{afterScore - summary.consistency}점
                  </span>
                </div>
                <div className="before-after-grid">
                  <div className="comparison-sample">
                    <StrokeThumbnail sample={samples[2]} label="교정 전 대표" />
                    <strong>{summary.consistency}<small>점</small></strong>
                  </div>
                  <span className="compare-arrow" aria-hidden="true">→</span>
                  <div className="comparison-sample after">
                    <StrokeThumbnail sample={afterSample} label="교정 후" />
                    <strong>{afterScore}<small>점</small></strong>
                  </div>
                </div>
              </div>
            )}

            <div className="metric-grid">
              {(
                [
                  ["size", "크기"],
                  ["speed", "속도"],
                  ["stroke", "획"],
                  ["rhythm", "리듬"],
                  ["shape", "균형"],
                ] as const
              ).map(([key, label]) => {
                const stability = Math.round(clamp(100 - summary.variations[key] * 180, 34, 98));
                return (
                  <div className={summary.focusKey === key ? "metric focus" : "metric"} key={key}>
                    <div><span>{label}</span><strong>{stability}</strong></div>
                    <div className="metric-track"><span style={{ width: `${stability}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="workspace-card coaching-card">
            <div className="one-thing">오늘의 한 가지</div>
            <p className="section-kicker">FOCUS · {summary.focusLabel}</p>
            <h2>{feedback.fix}</h2>
            <p className="reason">{feedback.reason}</p>
            {analysisMode === "ai" && feedback.characterTarget ? (
              <div className="character-insight-card">
                <div className="character-insight-topline">
                  <span>AI가 찾은 문제 글자</span>
                  <b className={`confidence ${feedback.characterConfidence}`}>
                    확신도 {feedback.characterConfidence === "high" ? "높음" : feedback.characterConfidence === "medium" ? "보통" : "낮음"}
                  </b>
                </div>
                <div className="character-insight-body">
                  <strong>{feedback.characterTarget}</strong>
                  <div>
                    <h3>{feedback.characterFinding}</h3>
                    <p>{feedback.characterEvidence}</p>
                  </div>
                </div>
              </div>
            ) : analysisMode === "ai" ? (
              <div className="character-insight-card uncertain">
                <span className="vision-mark" aria-hidden="true">◎</span>
                <div><strong>특정 글자를 억지로 고르지 않았어요</strong><p>이미지만으로 확신하기 어려워 전체 움직임 수치를 기준으로 코칭했어요.</p></div>
              </div>
            ) : (
              <div className="character-insight-card pending">
                <span className="vision-mark" aria-hidden="true">AI</span>
                <div><strong>문제 글자 직접 지목 준비 완료</strong><p>GPT-5.6 API를 연결하면 세 글씨를 보고 가장 불안정한 글자와 근거를 표시해요.</p></div>
              </div>
            )}
            <div className="coach-tip">
              <span>01</span>
              <div><strong>이렇게 연습해 보세요</strong><p>{feedback.tip}</p></div>
            </div>
            <div className="exercise-block">
              <span>추천 연습 단어</span>
              <div>{feedback.exercise.map((word) => <b key={word}>{word}</b>)}</div>
            </div>
            <p className="encouragement">“{feedback.encouragement}”</p>
            <button className="beautify-button" type="button" onClick={startBeautify}>
              <span className="beautify-spark" aria-hidden="true">✦</span>
              <span><strong>내 글씨 예쁘게 만들기</strong><small>나다움은 남기고 획의 흔들림만 정돈해요</small></span>
              <b aria-hidden="true">→</b>
            </button>
            <button className="character-lab-button" type="button" onClick={startCharacterPractice}>
              <span aria-hidden="true">{practiceCharacters[0] ?? "가"}</span>
              <span><strong>한 글자 집중 연습실</strong><small>획순 번호와 속도 히트맵 보기</small></span>
              <b aria-hidden="true">→</b>
            </button>
            <button className="primary-button full" type="button" onClick={startPractice}>
              {afterSample ? "한 번 더 교정 연습" : "이 포인트로 한 번 더 써보기"} <span aria-hidden="true">→</span>
            </button>
            <button className="restart-link" type="button" onClick={restart}>처음부터 새로 분석하기</button>
          </aside>
        </section>
      )}

      <footer>
        <span>글결 GeulGyeol · Hangul handwriting motion coach</span>
        <span>당신의 글씨를 바꾸지 않고, 더 당신답게.</span>
      </footer>
    </main>
  );
}
