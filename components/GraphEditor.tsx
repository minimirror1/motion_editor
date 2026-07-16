"use client";

import JSZip from "jszip";
import {
  ChangeEvent,
  Fragment,
  MouseEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MotionAxis = {
  index: number;
  name?: string;
  values: MotionValue[];
};

type MotionValue = number | null;

type PlotPoint = {
  x: number;
  y: number;
  frame: number;
};

type VisibleRange = {
  start: number;
  end: number;
};

type DegreeRange = {
  min: number;
  max: number;
};

type SelectedNode = {
  axisIndex: number;
  frame: number;
};

type NodeSelectionKind = "ctrl" | "range" | "single" | null;

type SaveGapDialogState = {
  axesWithMissing: number;
  frameCount: number;
  missingCount: number;
};

type ServerFileEntry = {
  name: string;
  relativePath: string;
  size: number;
  mtime: string;
};

type ServerBrowserState = {
  files: ServerFileEntry[];
  loading: boolean;
  error: string;
  notice: string;
};

type ServerSaveAsState = {
  name: string;
  strategy: MissingValueSaveStrategy;
};

type SaveDestination = "client" | "server" | "bundle";

type InfinityMode = "constant" | "cycle" | "oscillate" | "linear";

type AxisInfinity = { pre: InfinityMode; post: InfinityMode };

type EditorSnapshot = {
  axes: MotionAxis[];
  axisInfinity: Record<number, AxisInfinity>;
  bufferCurves: Record<number, MotionValue[]>;
  currentFrame: number;
  error: string;
  fileName: string;
  generatedSegmentId: number;
  generatedSegments: GeneratedSegment[];
  nodeDegreeInput: string;
  nodeSelectionKind: NodeSelectionKind;
  playbackRange: VisibleRange;
  selectedAxis: number | null;
  selectedGeneratedHandle: SelectedGeneratedHandle | null;
  selectedGeneratedSegmentKey: string | null;
  selectedNode: SelectedNode | null;
  selectedNodes: SelectedNode[];
  visibleRange: VisibleRange;
  yRange: DegreeRange;
};

type SegmentInterpolationMode =
  | "bezier"
  | "circular"
  | "cubic"
  | "exponential"
  | "flat"
  | "linear"
  | "quadratic"
  | "quartic"
  | "quintic"
  | "sinusoidal"
  | "stepped";
type GeneratedSegmentMode = SegmentInterpolationMode | "spline";

type MissingValueSaveStrategy = SegmentInterpolationMode;

type GeneratedSegment = {
  baselineValues?: Record<string, number>;
  handles: Record<string, GeneratedHandlePosition>;
  axisIndex: number;
  endFrame: number;
  id: number;
  initialHandles?: Record<string, GeneratedHandlePosition>;
  keyFrames: number[];
  mode: GeneratedSegmentMode;
  startFrame: number;
};

type CopiedAxisGeneratedSegment = Omit<GeneratedSegment, "axisIndex" | "id">;

type CopiedAxis = {
  generatedSegments: CopiedAxisGeneratedSegment[];
  name?: string;
  values: MotionValue[];
};

type CopiedGeneratedSegment = {
  duration: number;
  handles: Record<string, GeneratedHandlePosition>;
  initialHandles?: Record<string, GeneratedHandlePosition>;
  keyFrameOffsets: number[];
  mode: GeneratedSegmentMode;
  valueOffsets: Record<string, number>;
};

type CopiedNodeRange = {
  duration: number;
  nodes: Array<{
    offset: number;
    valueOffset: number;
  }>;
};

type GeneratedHandlePosition = {
  angle: number;
  leftLength: number;
  rightLength: number;
  // rightAngle이 없으면 Unify(양쪽 동일 각도), 있으면 Break(양쪽 독립 각도) 상태.
  rightAngle?: number;
  // true면 길이 Lock(한쪽 변경 시 반대쪽도 동일 길이로 동기화), false/undefined면 Free(독립).
  weightLocked?: boolean;
};

type GeneratedHandleField = keyof GeneratedHandlePosition;

type GeneratedHandleSide = "left" | "right";

type GeneratedHandleRenderData = {
  center: PlotPoint;
  left: PlotPoint;
  right: PlotPoint;
};

type SelectedGeneratedHandle = {
  frame: number;
  segmentId: number;
};

type GeneratedHandleDragState = SelectedGeneratedHandle & {
  centerFrame: number;
  centerValue: number;
  side: GeneratedHandleSide;
  moved: boolean;
};

type DragState = VisibleRange & {
  x: number;
  y: number;
  yMin: number;
  yMax: number;
};

type BoxSelectState = {
  axisIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type NodeValueDragState = {
  axisIndex: number;
  frame: number;
  startValue: number;
  startY: number;
  degreesPerPixel: number;
  moved: boolean;
};

type NodeFrameDragState = {
  axisIndex: number;
  startClientX: number;
  startClientY: number;
  framesPerPixel: number;
  valuePerPixel: number;
  baseValues: MotionValue[];
  origins: Array<{ frame: number; value: number }>;
  moved: boolean;
};

type RegionScaleEdge = "left" | "right" | "top" | "bottom";

type RegionScaleDragState = {
  axisIndex: number;
  edge: RegionScaleEdge;
  startClientX: number;
  startClientY: number;
  framesPerPixel: number;
  valuePerPixel: number;
  baseValues: MotionValue[];
  origins: Array<{ frame: number; value: number }>;
  minFrame: number;
  maxFrame: number;
  minValue: number;
  maxValue: number;
  moved: boolean;
};

type GenerationMenuState = {
  x: number;
  y: number;
};

type AxisContextMenuState =
  | {
      axisIndex: number;
      kind: "axis";
      x: number;
      y: number;
    }
  | {
      kind: "paste";
      x: number;
      y: number;
    };

type SegmentContextMenuState =
  | {
      kind: "copy";
      segmentId: number;
      x: number;
      y: number;
    }
  | {
      kind: "paste";
      x: number;
      y: number;
    };

type NodeRangeContextMenuState =
  | {
      kind: "copy";
      x: number;
      y: number;
    }
  | {
      kind: "paste";
      x: number;
      y: number;
    };

type AxisRenameDialogState = {
  axisIndex: number;
  value: string;
};

type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AxisStats = {
  index: number;
  name: string | null;
  nodeCount: number;
  visibleNodeCount: number;
  frameStart: number | null;
  frameEnd: number | null;
  minValue: number | null;
  minFrame: number | null;
  maxValue: number | null;
  maxFrame: number | null;
  range: number | null;
  mean: number | null;
  startValue: number | null;
  endValue: number | null;
  selectedFrame: number | null;
  selectedValue: number | null;
};

type SaveFilePickerWritable = {
  close: () => Promise<void>;
  write: (data: Blob) => Promise<void>;
};

type SaveFilePickerHandle = {
  name?: string;
  createWritable: () => Promise<SaveFilePickerWritable>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      accept: Record<string, string[]>;
      description: string;
    }>;
  }) => Promise<SaveFilePickerHandle>;
};

const axisColors = ["#2f9cff", "#ff2f62", "#39d353", "#ff9b36", "#b06cff", "#35d4d4"];
const GENERATED_SEGMENT_COLOR = "#8fa3b3";
const SELECTED_GENERATED_SEGMENT_COLOR = "#62d6ff";
const SHOW_ALL_NODE_MARKERS_VISIBLE_SPAN = 200;
const NODE_MARKER_SIZE_SCALE = 0.85;
const DISCONNECTED_NODE_MARKER_MULTIPLIER = 2.1 * (2 / NODE_MARKER_SIZE_SCALE);
const MAX_UNDO_HISTORY = 80;
const generationModeOptions: Array<{ id: GeneratedSegmentMode; label: string }> = [
  { id: "linear", label: "Linear" },
  { id: "flat", label: "Flat" },
  { id: "stepped", label: "Stepped" },
  { id: "bezier", label: "Bezier" },
  { id: "sinusoidal", label: "Sinusoidal" },
  { id: "quadratic", label: "Quadratic" },
  { id: "cubic", label: "Cubic" },
  { id: "quartic", label: "Quartic" },
  { id: "quintic", label: "Quintic" },
  { id: "exponential", label: "Exponetial" },
  { id: "circular", label: "Circular" },
  { id: "spline", label: "Spline" },
];
const generatedSegmentLabels: Record<GeneratedSegmentMode, string> = Object.fromEntries(
  generationModeOptions.map((mode) => [mode.id, mode.label]),
) as Record<GeneratedSegmentMode, string>;
const saveGapModeOptions = generationModeOptions.filter(
  (mode): mode is { id: SegmentInterpolationMode; label: string } => mode.id !== "spline",
);
const DEFAULT_CURRENT_FRAME = 10;
const DEFAULT_TIMELINE_MAX_FRAME = 119;
const DEFAULT_SPLINE_MIN_GAP = 2;
const DEFAULT_SPLINE_TENSION = 0;
const MAX_TIMELINE_FRAME = 100000;
const MOTION_FRAME_INTERVAL_SECONDS = 0.01;
const DEGREE_MATCH_TOLERANCE = 0.1;
// 플롯 SVG 세로 매핑: 값 범위가 y% 92(하단)~8(상단), 총 84%를 차지한다 (기존 92/84 수식과 동일한 기하).
const PLOT_VALUE_SPAN_PERCENT = 84;
const NODE_DRAG_DEAD_ZONE_PX = 3;
const DEFAULT_AXIS_INFINITY: AxisInfinity = { pre: "constant", post: "constant" };

const isMotionNumber = (value: MotionValue | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const framesToSeconds = (frames: number) => frames * MOTION_FRAME_INTERVAL_SECONDS;

// Maya Insert Key 방식 샘플링: 해당 프레임에 키가 있으면 그 값, 없으면 인접 키 선형 보간
// (렌더되는 폴리라인과 동일), 한쪽만 있으면 그 값, 키가 없으면 null.
const sampleAxisValueAtFrame = (values: MotionValue[], frame: number): number | null => {
  const direct = values[frame];
  if (isMotionNumber(direct)) return direct;

  let previousFrame = -1;
  for (let candidate = Math.min(frame, values.length - 1); candidate >= 0; candidate -= 1) {
    if (isMotionNumber(values[candidate])) {
      previousFrame = candidate;
      break;
    }
  }

  let nextFrame = -1;
  for (let candidate = Math.max(frame + 1, 0); candidate < values.length; candidate += 1) {
    if (isMotionNumber(values[candidate])) {
      nextFrame = candidate;
      break;
    }
  }

  const previousValue = previousFrame >= 0 ? (values[previousFrame] as number) : null;
  const nextValue = nextFrame >= 0 ? (values[nextFrame] as number) : null;

  if (previousValue !== null && nextValue !== null) {
    const ratio = (frame - previousFrame) / (nextFrame - previousFrame);
    return previousValue + (nextValue - previousValue) * ratio;
  }

  return previousValue ?? nextValue;
};

const handleAngleToSlope = (angle: number) => Math.tan((angle * Math.PI) / 180);

const parseCsvRecords = (text: string) => {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      record.push(field);
      if (record.some((value) => value.trim().length > 0)) {
        records.push(record);
      }
      field = "";
      record = [];
      continue;
    }

    field += char;
  }

  record.push(field);
  if (record.some((value) => value.trim().length > 0)) {
    records.push(record);
  }

  return records;
};

const parseMotionCsv = (text: string): MotionAxis[] =>
  parseCsvRecords(text)
    .map((record, index) => ({
      index,
      values: record.map((value) => Number(value.trim())).filter(Number.isFinite),
    }))
    .filter((axis) => axis.values.length > 0);

const formatCsvNumber = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

const getMotionFrameCount = (axes: MotionAxis[]) =>
  axes.reduce((maxFrameCount, axis) => Math.max(maxFrameCount, axis.values.length), 0);

const getLastMotionValueFrame = (values: MotionValue[]) => {
  for (let frame = values.length - 1; frame >= 0; frame -= 1) {
    if (isMotionNumber(values[frame])) return frame;
  }

  return null;
};

const getFirstMotionValueFrame = (values: MotionValue[]) => {
  for (let frame = 0; frame < values.length; frame += 1) {
    if (isMotionNumber(values[frame])) return frame;
  }

  return null;
};

const wrapModulo = (value: number, period: number) => ((value % period) + period) % period;

// Maya Pre/Post Infinity 평가: 데이터 범위 밖 프레임의 값을 모드에 따라 계산한다.
// cycle/oscillate는 원본 키 패턴(빈 프레임 포함)을 그대로 반복 복사하고,
// linear는 가장자리 키와 안쪽 이웃 키의 기울기로 외삽한다.
const evaluateInfinityFrame = (
  values: MotionValue[],
  firstFrame: number,
  lastFrame: number,
  frame: number,
  mode: InfinityMode,
): MotionValue => {
  const period = lastFrame - firstFrame;
  const edgeValue = frame < firstFrame ? values[firstFrame] : values[lastFrame];

  if (mode === "constant" || period <= 0) {
    return edgeValue ?? null;
  }

  if (mode === "cycle") {
    return values[firstFrame + wrapModulo(frame - firstFrame, period)] ?? null;
  }

  if (mode === "oscillate") {
    const phase = wrapModulo(frame - firstFrame, period * 2);
    return values[firstFrame + (phase <= period ? phase : period * 2 - phase)] ?? null;
  }

  if (!isMotionNumber(edgeValue)) return null;

  if (frame < firstFrame) {
    let neighborFrame = -1;
    for (let candidate = firstFrame + 1; candidate <= lastFrame; candidate += 1) {
      if (isMotionNumber(values[candidate])) {
        neighborFrame = candidate;
        break;
      }
    }
    if (neighborFrame < 0) return edgeValue;

    const slope = ((values[neighborFrame] as number) - edgeValue) / (neighborFrame - firstFrame);
    return edgeValue + slope * (frame - firstFrame);
  }

  let neighborFrame = -1;
  for (let candidate = lastFrame - 1; candidate >= firstFrame; candidate -= 1) {
    if (isMotionNumber(values[candidate])) {
      neighborFrame = candidate;
      break;
    }
  }
  if (neighborFrame < 0) return edgeValue;

  const slope = (edgeValue - (values[neighborFrame] as number)) / (lastFrame - neighborFrame);
  return edgeValue + slope * (frame - lastFrame);
};

const getMotionSaveFrameCount = (axes: MotionAxis[]) =>
  axes.reduce((maxFrameCount, axis) => {
    const lastFrame = getLastMotionValueFrame(axis.values);

    return lastFrame === null ? maxFrameCount : Math.max(maxFrameCount, lastFrame + 1);
  }, 0);

const getSaveGapStats = (axes: MotionAxis[]): SaveGapDialogState => {
  const frameCount = getMotionSaveFrameCount(axes);
  let missingCount = 0;
  let axesWithMissing = 0;

  axes.forEach((axis) => {
    let axisMissingCount = 0;

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (!isMotionNumber(axis.values[frame])) {
        axisMissingCount += 1;
      }
    }

    if (axisMissingCount > 0) {
      axesWithMissing += 1;
      missingCount += axisMissingCount;
    }
  });

  return { axesWithMissing, frameCount, missingCount };
};

const findMotionValueEntry = (values: MotionValue[], startFrame: number, step: -1 | 1, boundaryFrame: number) => {
  for (
    let frame = startFrame;
    step > 0 ? frame <= boundaryFrame : frame >= boundaryFrame;
    frame += step
  ) {
    const value = values[frame];

    if (isMotionNumber(value)) {
      return { frame, value };
    }
  }

  return null;
};

const buildSaveAxisValues = (
  values: MotionValue[],
  frameCount: number,
  strategy: MissingValueSaveStrategy,
): MotionValue[] => {
  const nextValues = Array.from({ length: frameCount }, (_, frame) => values[frame] ?? null);

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (isMotionNumber(nextValues[frame])) continue;

    const previous = findMotionValueEntry(nextValues, frame - 1, -1, 0);
    const next = findMotionValueEntry(nextValues, frame + 1, 1, frameCount - 1);

    if (previous && next && next.frame !== previous.frame) {
      const ratio = (frame - previous.frame) / (next.frame - previous.frame);
      const interpolationRatio = strategy === "linear" ? ratio : buildInterpolationRatio(ratio, strategy);
      nextValues[frame] = previous.value + (next.value - previous.value) * interpolationRatio;
    } else {
      nextValues[frame] = previous?.value ?? next?.value ?? 0;
    }
  }

  return nextValues;
};

const serializeMotionCsv = (axes: MotionAxis[], missingValueStrategy: MissingValueSaveStrategy = "linear") => {
  const frameCount = getMotionSaveFrameCount(axes);

  return axes
    .map((axis) =>
      buildSaveAxisValues(axis.values, frameCount, missingValueStrategy)
        .map((value) => (isMotionNumber(value) ? formatCsvNumber(value) : ""))
        .join(","),
    )
    .join("\n");
};

const ensureCsvFileName = (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) return "motion.csv";

  return trimmedName.toLowerCase().endsWith(".csv") ? trimmedName : `${trimmedName}.csv`;
};

// ---- 모션 메타 사이드카 (<파일명>.csv.meta.json) ----
// CSV는 외부 소비자 호환을 위해 순수 숫자 데이터만 유지하고,
// 생성 세그먼트(베지어 핸들 각도/길이 포함)·Infinity 모드·축 이름은 사이드카 JSON에 영속화한다.
const MOTION_META_VERSION = 1;

const motionMetaPathFor = (csvPath: string) => `${csvPath}.meta.json`;

type MotionMeta = {
  generatedSegments: GeneratedSegment[];
  axisInfinity: Record<number, AxisInfinity>;
  axisNames: Record<number, string>;
};

const serializeMotionMeta = (
  axes: MotionAxis[],
  generatedSegments: GeneratedSegment[],
  axisInfinity: Record<number, AxisInfinity>,
): string =>
  JSON.stringify(
    {
      version: MOTION_META_VERSION,
      generatedSegments,
      axisInfinity,
      axisNames: Object.fromEntries(
        axes.filter((axis) => axis.name !== undefined).map((axis) => [axis.index, axis.name]),
      ),
    },
    null,
    2,
  );

const isValidInfinityMode = (mode: unknown): mode is InfinityMode =>
  mode === "constant" || mode === "cycle" || mode === "oscillate" || mode === "linear";

const isValidGeneratedHandlePosition = (handle: unknown): handle is GeneratedHandlePosition => {
  if (typeof handle !== "object" || handle === null) return false;

  const candidate = handle as Record<string, unknown>;
  return (
    Number.isFinite(candidate.angle) &&
    Number.isFinite(candidate.leftLength) &&
    Number.isFinite(candidate.rightLength) &&
    (candidate.rightAngle === undefined || Number.isFinite(candidate.rightAngle)) &&
    (candidate.weightLocked === undefined || typeof candidate.weightLocked === "boolean")
  );
};

const isValidHandleRecord = (record: unknown): record is Record<string, GeneratedHandlePosition> =>
  typeof record === "object" &&
  record !== null &&
  Object.values(record).every((handle) => isValidGeneratedHandlePosition(handle));

const isValidGeneratedSegment = (segment: unknown, axes: MotionAxis[]): segment is GeneratedSegment => {
  if (typeof segment !== "object" || segment === null) return false;

  const candidate = segment as Record<string, unknown>;
  const axis = axes.find((entry) => entry.index === candidate.axisIndex);
  if (!axis) return false;

  const maxFrame = axis.values.length - 1;
  const isValidFrame = (frame: unknown): frame is number =>
    typeof frame === "number" && Number.isInteger(frame) && frame >= 0 && frame <= maxFrame;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.mode === "string" &&
    candidate.mode in generatedSegmentLabels &&
    isValidFrame(candidate.startFrame) &&
    isValidFrame(candidate.endFrame) &&
    Array.isArray(candidate.keyFrames) &&
    candidate.keyFrames.length >= 2 &&
    candidate.keyFrames.every(isValidFrame) &&
    isValidHandleRecord(candidate.handles) &&
    (candidate.initialHandles === undefined || isValidHandleRecord(candidate.initialHandles)) &&
    (candidate.baselineValues === undefined ||
      (typeof candidate.baselineValues === "object" &&
        candidate.baselineValues !== null &&
        Object.values(candidate.baselineValues).every((value) => Number.isFinite(value))))
  );
};

// meta JSON을 파싱·검증한다. 손상되었거나 현재 CSV와 안 맞는 항목은 조용히 버려
// meta가 없거나 깨져도 CSV 로드는 종전과 동일하게 동작한다.
const parseMotionMeta = (text: string | null, axes: MotionAxis[]): MotionMeta => {
  const emptyMeta: MotionMeta = { generatedSegments: [], axisInfinity: {}, axisNames: {} };
  if (!text) return emptyMeta;

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return emptyMeta;

    const candidate = parsed as Record<string, unknown>;
    const generatedSegments = Array.isArray(candidate.generatedSegments)
      ? candidate.generatedSegments.filter((segment): segment is GeneratedSegment =>
          isValidGeneratedSegment(segment, axes),
        )
      : [];
    const axisInfinity =
      typeof candidate.axisInfinity === "object" && candidate.axisInfinity !== null
        ? Object.fromEntries(
            Object.entries(candidate.axisInfinity).filter(
              ([axisIndex, modes]) =>
                axes.some((axis) => axis.index === Number(axisIndex)) &&
                typeof modes === "object" &&
                modes !== null &&
                isValidInfinityMode((modes as Record<string, unknown>).pre) &&
                isValidInfinityMode((modes as Record<string, unknown>).post),
            ),
          )
        : {};
    const axisNames =
      typeof candidate.axisNames === "object" && candidate.axisNames !== null
        ? Object.fromEntries(
            Object.entries(candidate.axisNames).filter(
              ([axisIndex, name]) =>
                axes.some((axis) => axis.index === Number(axisIndex)) && typeof name === "string",
            ),
          )
        : {};

    return {
      generatedSegments,
      axisInfinity: axisInfinity as Record<number, AxisInfinity>,
      axisNames: axisNames as Record<number, string>,
    };
  } catch {
    return emptyMeta;
  }
};

// ---- 모션 번들 (.zip: csv + meta 한 파일) ----
// csv/meta를 zip 하나로 묶어 PC 간 이동 시 meta 누락 위험을 없앤다.
// 엔트리 이름은 고정(canonical)이라 바깥 zip 파일명과 무관하게 파싱된다.
const MOTION_BUNDLE_CSV_ENTRY = "motion.csv";
const MOTION_BUNDLE_META_ENTRY = "motion.csv.meta.json";

const serializeMotionBundle = (
  axes: MotionAxis[],
  generatedSegments: GeneratedSegment[],
  axisInfinity: Record<number, AxisInfinity>,
  missingValueStrategy: MissingValueSaveStrategy,
): Promise<Blob> => {
  const zip = new JSZip();
  zip.file(MOTION_BUNDLE_CSV_ENTRY, serializeMotionCsv(axes, missingValueStrategy));
  zip.file(MOTION_BUNDLE_META_ENTRY, serializeMotionMeta(axes, generatedSegments, axisInfinity));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
};

// zip에서 csv/meta 텍스트를 꺼낸다. canonical 엔트리 우선, 없으면 확장자로 폴백.
// zip이 아니거나 csv 엔트리가 없으면 null (호출부에서 에러 표시).
const parseMotionBundle = async (file: Blob): Promise<{ csvText: string; metaText: string | null } | null> => {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const csvEntry = zip.file(MOTION_BUNDLE_CSV_ENTRY) ?? zip.file(/\.csv$/i)[0] ?? null;
    if (!csvEntry) return null;

    const metaEntry = zip.file(MOTION_BUNDLE_META_ENTRY) ?? zip.file(/\.csv\.meta\.json$/i)[0] ?? null;
    return {
      csvText: await csvEntry.async("string"),
      metaText: metaEntry ? await metaEntry.async("string") : null,
    };
  } catch {
    return null;
  }
};

const ensureZipFileName = (name: string) => {
  const baseName = name.trim().replace(/\.zip$/i, "").replace(/\.csv$/i, "");
  return `${baseName || "motion"}.zip`;
};

const buildInterpolationRatio = (ratio: number, mode: SegmentInterpolationMode) => {
  if (mode === "bezier") {
    const inverseRatio = 1 - ratio;
    return 3 * inverseRatio * inverseRatio * ratio * 0.25 + 3 * inverseRatio * ratio * ratio * 0.75 + ratio ** 3;
  }

  if (mode === "circular") {
    return 1 - Math.sqrt(1 - ratio * ratio);
  }

  if (mode === "cubic" || mode === "flat") {
    // Flat: 양 끝 기울기 0, 오버슈트 없음 — 기존 cubic(smoothstep) 곡선을 그대로 재사용한다.
    return ratio * ratio * (3 - 2 * ratio);
  }

  if (mode === "stepped") {
    return ratio >= 1 ? 1 : 0;
  }

  if (mode === "exponential") {
    if (ratio === 0 || ratio === 1) return ratio;
    return 2 ** (10 * ratio - 10);
  }

  if (mode === "quadratic") {
    return ratio < 0.5 ? 2 * ratio * ratio : 1 - (-2 * ratio + 2) ** 2 / 2;
  }

  if (mode === "quartic") {
    return ratio < 0.5 ? 8 * ratio ** 4 : 1 - (-2 * ratio + 2) ** 4 / 2;
  }

  if (mode === "quintic") {
    return ratio * ratio * ratio * (10 - 15 * ratio + 6 * ratio * ratio);
  }

  if (mode === "sinusoidal") {
    return -(Math.cos(Math.PI * ratio) - 1) / 2;
  }

  return ratio;
};

const buildGenerationModePreviewPoints = (mode: GeneratedSegmentMode) => {
  const samples = 18;
  const points = [];

  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    let value: number;

    if (mode === "spline") {
      value = 0.5 - Math.cos(ratio * Math.PI) / 2;
    } else {
      value = buildInterpolationRatio(ratio, mode);
    }

    points.push(`${4 + ratio * 32},${30 - value * 22}`);
  }

  return points.join(" ");
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildDataYRange = (axes: MotionAxis[]): DegreeRange => {
  const values = axes.flatMap((axis) => axis.values).filter(isMotionNumber);
  if (values.length === 0) {
    return { min: -90, max: 90 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.08, 1);

  return {
    min: min - padding,
    max: max + padding,
  };
};

const clampRange = (start: number, span: number, maxIndex: number): VisibleRange => {
  if (maxIndex <= 0) {
    return { start: 0, end: 0 };
  }

  const minSpan = Math.min(8, maxIndex);
  const nextSpan = clamp(span, minSpan, 100000);
  const nextStart = Math.max(0, start);

  return {
    start: nextStart,
    end: nextStart + nextSpan,
  };
};

const clampFreeRange = (start: number, span: number): VisibleRange => {
  const nextSpan = clamp(span, 1, 100000);
  const nextStart = Math.max(0, start);

  return {
    start: nextStart,
    end: nextStart + nextSpan,
  };
};

const buildNiceStep = (roughStep: number) => {
  const power = 10 ** Math.floor(Math.log10(Math.max(roughStep, Number.EPSILON)));
  const scaled = roughStep / power;
  const multiplier = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return multiplier * power;
};

const buildFrameMarks = (range: VisibleRange) => {
  const span = Math.max(range.end - range.start, 1);
  const step = Math.max(1, Math.round(buildNiceStep(span / 8)));
  const first = Math.ceil(range.start / step) * step;
  const marks = [];

  for (let frame = first; frame <= range.end + 0.0001; frame += step) {
    marks.push({
      frame,
      x: ((frame - range.start) / span) * 100,
    });
  }

  return marks;
};

const buildYMarks = (min: number, max: number) => {
  const span = Math.max(max - min, 0.001);
  const zoomDensity =
    span <= 8 ? 18 : span <= 16 ? 15 : span <= 32 ? 12 : span <= 64 ? 10 : span <= 120 ? 8 : 5;
  const step = Math.max(0.1, buildNiceStep(span / zoomDensity));
  const first = Math.ceil(min / step) * step;
  const marks = [];

  for (let value = first; value <= max + 0.0001; value += step) {
    marks.push({
      value,
      y: 92 - ((value - min) / span) * 84,
    });
  }

  return marks;
};

const formatDegree = (value: number) => {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
};

const formatStatNumber = (value: number | null) => {
  if (value === null) return "-";
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
};


const formatFrameTime = (frame: number) => `${(frame * MOTION_FRAME_INTERVAL_SECONDS).toFixed(2)}s`;

const formatAxisDisplayName = (axis: MotionAxis | null | undefined) =>
  axis?.name ? axis.name : axis ? formatStatNumber(axis.index) : "-";

const getAxisNumericDisplayValue = (axis: MotionAxis | undefined) => {
  if (!axis) return -1;

  const displayValue = axis.name?.trim() ?? axis.index.toString();
  const parsedValue = Number(displayValue);

  return Number.isFinite(parsedValue) ? Math.floor(parsedValue) : axis.index;
};

const getNextAxisIndex = (axes: MotionAxis[]) => {
  const usedIndexes = new Set(axes.map((axis) => axis.index));
  let nextIndex = getAxisNumericDisplayValue(axes.at(-1)) + 1;

  while (usedIndexes.has(nextIndex)) {
    nextIndex += 1;
  }

  return nextIndex;
};

const isNumericAxisName = (name: string | undefined) =>
  name !== undefined && name.trim().length > 0 && Number.isFinite(Number(name.trim()));

const getAxisRightmostNodeIndexMismatch = (axes: MotionAxis[]) => {
  if (axes.length <= 1) return null;

  const expectedLastNodeIndex = getLastMotionValueFrame(axes[0].values);
  const axis = axes.find(
    (candidate) => getLastMotionValueFrame(candidate.values) !== expectedLastNodeIndex,
  );

  return axis
    ? {
        actualLastNodeIndex: getLastMotionValueFrame(axis.values),
        axis,
        expectedLastNodeIndex,
      }
    : null;
};

const buildAxisStats = (
  axis: MotionAxis,
  visibleNodeCount: number,
  selectedNode: SelectedNode | null,
): AxisStats => {
  const { values } = axis;
  const selectedFrame = selectedNode?.axisIndex === axis.index ? selectedNode.frame : null;
  const selectedValue = selectedFrame !== null && isMotionNumber(values[selectedFrame]) ? values[selectedFrame] : null;
  const numericEntries = values
    .map((value, frame) => (isMotionNumber(value) ? { frame, value } : null))
    .filter((entry): entry is { frame: number; value: number } => entry !== null);

  if (numericEntries.length === 0) {
    return {
      index: axis.index,
      name: axis.name ?? null,
      nodeCount: 0,
      visibleNodeCount,
      frameStart: null,
      frameEnd: null,
      minValue: null,
      minFrame: null,
      maxValue: null,
      maxFrame: null,
      range: null,
      mean: null,
      startValue: null,
      endValue: null,
      selectedFrame,
      selectedValue,
    };
  }

  let minValue = numericEntries[0].value;
  let maxValue = numericEntries[0].value;
  let minFrame = numericEntries[0].frame;
  let maxFrame = numericEntries[0].frame;
  let sum = 0;

  numericEntries.forEach(({ value, frame }) => {
    sum += value;
    if (value < minValue) {
      minValue = value;
      minFrame = frame;
    }
    if (value > maxValue) {
      maxValue = value;
      maxFrame = frame;
    }
  });

  return {
    index: axis.index,
    name: axis.name ?? null,
    nodeCount: numericEntries.length,
    visibleNodeCount,
    frameStart: numericEntries[0].frame,
    frameEnd: numericEntries[numericEntries.length - 1].frame,
    minValue,
    minFrame,
    maxValue,
    maxFrame,
    range: maxValue - minValue,
    mean: sum / numericEntries.length,
    startValue: numericEntries[0].value,
    endValue: numericEntries[numericEntries.length - 1].value,
    selectedFrame,
    selectedValue,
  };
};

const toPlotPoints = (
  values: MotionValue[],
  range: VisibleRange,
  yMin: number,
  yMax: number,
): PlotPoint[] => {
  const visibleSpan = Math.max(range.end - range.start, 1);
  const ySpan = Math.max(yMax - yMin, 1);
  const startFrame = Math.max(0, Math.floor(range.start) - 1);
  const endFrame = Math.min(values.length - 1, Math.ceil(range.end) + 1);
  const points: PlotPoint[] = [];

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const value = values[frame];
    if (!isMotionNumber(value)) continue;

    points.push({
      frame,
      x: ((frame - range.start) / visibleSpan) * 100,
      y: 92 - ((value - yMin) / ySpan) * 84,
    });
  }

  return points;
};

const buildDisconnectedFrameSet = (values: MotionValue[]) => {
  const frames = new Set<number>();
  let previousFrame: number | null = null;

  values.forEach((value, frame) => {
    if (!isMotionNumber(value)) return;

    if (previousFrame !== null && frame - previousFrame > 1) {
      frames.add(previousFrame);
      frames.add(frame);
    }

    previousFrame = frame;
  });

  return frames;
};

const hasOtherAxisMatchingEndNode = (
  axes: MotionAxis[],
  selectedAxis: number,
  frame: number,
  value: number,
) =>
  axes.some((axis) => {
    if (axis.index === selectedAxis) return false;

    const lastFrame = getLastMotionValueFrame(axis.values);
    if (lastFrame !== frame) return false;

    const lastValue = axis.values[lastFrame];

    return isMotionNumber(lastValue) && Math.abs(lastValue - value) <= DEGREE_MATCH_TOLERANCE;
  });

const toPolyline = (points: PlotPoint[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const toPlotSegments = (
  values: MotionValue[],
  range: VisibleRange,
  yMin: number,
  yMax: number,
): PlotPoint[][] => {
  const visibleSpan = Math.max(range.end - range.start, 1);
  const ySpan = Math.max(yMax - yMin, 1);
  const startFrame = Math.max(0, Math.floor(range.start) - 1);
  const endFrame = Math.min(values.length - 1, Math.ceil(range.end) + 1);
  const segments: PlotPoint[][] = [];
  let currentSegment: PlotPoint[] = [];

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const value = values[frame];

    if (!isMotionNumber(value)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      continue;
    }

    currentSegment.push({
      frame,
      x: ((frame - range.start) / visibleSpan) * 100,
      y: 92 - ((value - yMin) / ySpan) * 84,
    });
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

const toGeneratedSegmentPoints = (
  values: MotionValue[],
  range: VisibleRange,
  yMin: number,
  yMax: number,
  segment: GeneratedSegment,
): PlotPoint[] => {
  const visibleSpan = Math.max(range.end - range.start, 1);
  const ySpan = Math.max(yMax - yMin, 1);
  const startFrame = Math.max(0, Math.floor(Math.max(segment.startFrame, range.start)));
  const endFrame = Math.min(values.length - 1, Math.ceil(Math.min(segment.endFrame, range.end)));
  const points: PlotPoint[] = [];

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const value = values[frame];
    if (!isMotionNumber(value)) continue;

    points.push({
      frame,
      x: ((frame - range.start) / visibleSpan) * 100,
      y: 92 - ((value - yMin) / ySpan) * 84,
    });
  }

  return points;
};

const toGeneratedSegmentPreviewPoints = (values: MotionValue[], segment: GeneratedSegment): PlotPoint[] => {
  const entries: Array<{ frame: number; value: number }> = [];

  for (let frame = segment.startFrame; frame <= segment.endFrame; frame += 1) {
    const value = values[frame];
    if (isMotionNumber(value)) {
      entries.push({ frame, value });
    }
  }

  if (entries.length === 0) return [];

  const minValue = Math.min(...entries.map((entry) => entry.value));
  const maxValue = Math.max(...entries.map((entry) => entry.value));
  const valuePadding = Math.max((maxValue - minValue) * 0.12, 1);
  const yMin = minValue - valuePadding;
  const yMax = maxValue + valuePadding;
  const ySpan = Math.max(yMax - yMin, 1);
  const frameSpan = Math.max(segment.endFrame - segment.startFrame, 1);

  return entries.map((entry) => ({
    frame: entry.frame,
    x: 4 + ((entry.frame - segment.startFrame) / frameSpan) * 92,
    y: 56 - ((entry.value - yMin) / ySpan) * 48,
  }));
};

const toPlotPosition = (frame: number, value: number, range: VisibleRange, yMin: number, yMax: number): PlotPoint => {
  const visibleSpan = Math.max(range.end - range.start, 1);
  const ySpan = Math.max(yMax - yMin, 1);

  return {
    frame,
    x: ((frame - range.start) / visibleSpan) * 100,
    y: 92 - ((value - yMin) / ySpan) * 84,
  };
};

const findNearestMotionFrame = (
  values: MotionValue[],
  startFrame: number,
  step: -1 | 1,
  boundaryFrame: number,
) => {
  for (
    let frame = startFrame;
    step > 0 ? frame <= boundaryFrame && frame < values.length : frame >= boundaryFrame && frame >= 0;
    frame += step
  ) {
    if (isMotionNumber(values[frame])) return frame;
  }

  return null;
};

const buildMotionValueTolerance = (values: MotionValue[]) => {
  const numericValues = values.filter(isMotionNumber);
  if (numericValues.length === 0) return 0.25;

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);

  return Math.max(0.25, (maxValue - minValue) * 0.01);
};

const estimateMotionTangentLength = (
  values: MotionValue[],
  frame: number,
  value: number,
  slope: number,
  direction: -1 | 1,
  keyFrameGap: number,
  tolerance: number,
) => {
  const maxLength = Math.max(0.5, keyFrameGap * 0.48);
  const maxSampleOffset = Math.max(1, Math.floor(maxLength));
  let lastMatchingOffset = 0;

  for (let offset = 1; offset <= maxSampleOffset; offset += 1) {
    const sampleFrame = frame + direction * offset;
    const sampleValue = values[sampleFrame];

    if (!isMotionNumber(sampleValue)) break;

    const tangentValue = value + slope * framesToSeconds(sampleFrame - frame);
    const error = Math.abs(sampleValue - tangentValue);

    if (error > tolerance) break;
    lastMatchingOffset = offset;
  }

  if (lastMatchingOffset > 0) {
    return clamp(lastMatchingOffset, 0.5, maxLength);
  }

  const adjacentFrame = frame + direction;
  const adjacentValue = values[adjacentFrame];

  if (isMotionNumber(adjacentValue)) {
    const adjacentSlope = (adjacentValue - value) / framesToSeconds(adjacentFrame - frame);
    const slopeDifference = Math.abs(adjacentSlope - slope);
    const slopeScale = Math.max(Math.abs(slope), 1);

    return clamp(keyFrameGap / (2 + slopeDifference / slopeScale), 0.5, maxLength);
  }

  return clamp(keyFrameGap / 3, 0.5, maxLength);
};

const buildDefaultGeneratedHandlePosition = (
  values: MotionValue[],
  keyFrames: number[],
  frame: number,
): GeneratedHandlePosition | null => {
  const sortedKeyFrames = [...keyFrames].sort((left, right) => left - right);
  const keyIndex = sortedKeyFrames.indexOf(frame);
  const value = values[frame];

  if (keyIndex < 0 || !isMotionNumber(value)) return null;

  const previousKeyFrame = sortedKeyFrames[keyIndex - 1] ?? null;
  const nextKeyFrame = sortedKeyFrames[keyIndex + 1] ?? null;
  const leftGap =
    previousKeyFrame === null
      ? nextKeyFrame === null
        ? 3
        : Math.max(nextKeyFrame - frame, 1)
      : Math.max(frame - previousKeyFrame, 1);
  const rightGap =
    nextKeyFrame === null
      ? previousKeyFrame === null
        ? 3
        : Math.max(frame - previousKeyFrame, 1)
      : Math.max(nextKeyFrame - frame, 1);
  const previousSampleFrame = findNearestMotionFrame(values, frame - 1, -1, previousKeyFrame ?? 0);
  const nextSampleFrame = findNearestMotionFrame(values, frame + 1, 1, nextKeyFrame ?? values.length - 1);
  const previousValue = previousSampleFrame === null ? null : values[previousSampleFrame];
  const nextValue = nextSampleFrame === null ? null : values[nextSampleFrame];
  let slope = 0;

  if (
    previousSampleFrame !== null &&
    nextSampleFrame !== null &&
    isMotionNumber(previousValue) &&
    isMotionNumber(nextValue)
  ) {
    slope = (nextValue - previousValue) / framesToSeconds(Math.max(nextSampleFrame - previousSampleFrame, 1));
  } else if (nextSampleFrame !== null && isMotionNumber(nextValue)) {
    slope = (nextValue - value) / framesToSeconds(Math.max(nextSampleFrame - frame, 1));
  } else if (previousSampleFrame !== null && isMotionNumber(previousValue)) {
    slope = (value - previousValue) / framesToSeconds(Math.max(frame - previousSampleFrame, 1));
  }

  const tolerance = buildMotionValueTolerance(values);
  const leftLength = estimateMotionTangentLength(values, frame, value, slope, -1, leftGap, tolerance);
  const rightLength = estimateMotionTangentLength(values, frame, value, slope, 1, rightGap, tolerance);

  return {
    angle: Math.atan(slope) * (180 / Math.PI),
    leftLength,
    rightLength,
  };
};

const buildGeneratedSegmentHandles = (
  values: MotionValue[],
  keyFrames: number[],
  mode: GeneratedSegmentMode,
): Record<string, GeneratedHandlePosition> => {
  if (mode === "linear") return {};

  return Object.fromEntries(
    keyFrames
      .map((frame) => {
        const handle = buildDefaultGeneratedHandlePosition(values, keyFrames, frame);
        return handle ? [frame.toString(), handle] : null;
      })
      .filter((entry): entry is [string, GeneratedHandlePosition] => entry !== null),
  );
};

const cubicBezierPoint = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
};

const cloneGeneratedHandles = (handles: Record<string, GeneratedHandlePosition>) =>
  Object.fromEntries(
    Object.entries(handles).map(([frame, handle]) => [frame, { ...handle }]),
  ) as Record<string, GeneratedHandlePosition>;

const cloneGeneratedBaselineValues = (baselineValues: Record<string, number> | undefined) =>
  baselineValues ? { ...baselineValues } : undefined;

const copyGeneratedSegmentForAxis = (segment: GeneratedSegment): CopiedAxisGeneratedSegment => ({
  baselineValues: cloneGeneratedBaselineValues(segment.baselineValues),
  handles: cloneGeneratedHandles(segment.handles),
  endFrame: segment.endFrame,
  initialHandles: segment.initialHandles ? cloneGeneratedHandles(segment.initialHandles) : undefined,
  keyFrames: [...segment.keyFrames],
  mode: segment.mode,
  startFrame: segment.startFrame,
});

const restoreCopiedGeneratedSegmentForAxis = (
  segment: CopiedAxisGeneratedSegment,
  axisIndex: number,
  id: number,
): GeneratedSegment => ({
  baselineValues: cloneGeneratedBaselineValues(segment.baselineValues),
  handles: cloneGeneratedHandles(segment.handles),
  axisIndex,
  endFrame: segment.endFrame,
  id,
  initialHandles: segment.initialHandles ? cloneGeneratedHandles(segment.initialHandles) : undefined,
  keyFrames: [...segment.keyFrames],
  mode: segment.mode,
  startFrame: segment.startFrame,
});

const copyGeneratedHandleOffsets = (handles: Record<string, GeneratedHandlePosition>, startFrame: number) =>
  Object.fromEntries(
    Object.entries(handles)
      .map(([frame, handle]) => {
        const offset = Number(frame) - startFrame;
        return Number.isFinite(offset) ? [offset.toString(), { ...handle }] : null;
      })
      .filter((entry): entry is [string, GeneratedHandlePosition] => entry !== null),
  ) as Record<string, GeneratedHandlePosition>;

const restoreGeneratedHandleOffsets = (handles: Record<string, GeneratedHandlePosition>, startFrame: number) =>
  Object.fromEntries(
    Object.entries(handles)
      .map(([offset, handle]) => {
        const frame = startFrame + Number(offset);
        return Number.isFinite(frame) ? [frame.toString(), { ...handle }] : null;
      })
      .filter((entry): entry is [string, GeneratedHandlePosition] => entry !== null),
  ) as Record<string, GeneratedHandlePosition>;

const copyGeneratedSegmentForPaste = (
  segment: GeneratedSegment,
  values: MotionValue[],
): CopiedGeneratedSegment | null => {
  const startFrame = Math.min(segment.startFrame, segment.endFrame);
  const endFrame = Math.max(segment.startFrame, segment.endFrame);
  const startValue = values[startFrame];

  if (!isMotionNumber(startValue) || endFrame <= startFrame) return null;

  const valueOffsets: Record<string, number> = {};

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const value = values[frame];

    if (isMotionNumber(value)) {
      valueOffsets[(frame - startFrame).toString()] = value - startValue;
    }
  }

  return {
    duration: endFrame - startFrame,
    handles: copyGeneratedHandleOffsets(segment.handles, startFrame),
    initialHandles: segment.initialHandles
      ? copyGeneratedHandleOffsets(segment.initialHandles, startFrame)
      : undefined,
    keyFrameOffsets: segment.keyFrames.map((frame) => frame - startFrame),
    mode: segment.mode,
    valueOffsets,
  };
};

const cloneMotionAxes = (axes: MotionAxis[]) =>
  axes.map((axis) => ({
    ...axis,
    values: [...axis.values],
  }));

const cloneGeneratedSegments = (segments: GeneratedSegment[]) =>
  segments.map((segment) => ({
    ...segment,
    baselineValues: cloneGeneratedBaselineValues(segment.baselineValues),
    handles: cloneGeneratedHandles(segment.handles),
    initialHandles: segment.initialHandles ? cloneGeneratedHandles(segment.initialHandles) : undefined,
    keyFrames: [...segment.keyFrames],
  }));

const cloneSelectedNode = (node: SelectedNode | null) => (node ? { ...node } : null);

const cloneSelectedNodes = (nodes: SelectedNode[]) => nodes.map((node) => ({ ...node }));

const cloneSelectedGeneratedHandle = (handle: SelectedGeneratedHandle | null) => (handle ? { ...handle } : null);

const shiftGeneratedFrameRecord = <Value,>(
  record: Record<string, Value> | undefined,
  anchorFrame: number,
  shiftAmount: number,
) =>
  record
    ? Object.fromEntries(
        Object.entries(record).map(([frame, value]) => {
          const frameNumber = Number(frame);
          const nextFrame = frameNumber >= anchorFrame ? frameNumber - shiftAmount : frameNumber;

          return [nextFrame.toString(), value];
        }),
      )
    : undefined;

const shiftGeneratedSegmentFrames = (
  segment: GeneratedSegment,
  anchorFrame: number,
  shiftAmount: number,
): GeneratedSegment => {
  if (segment.endFrame < anchorFrame) return segment;

  const shiftFrame = (frame: number) => (frame >= anchorFrame ? frame - shiftAmount : frame);
  const keyFrames = [...new Set(segment.keyFrames.map(shiftFrame))].sort((left, right) => left - right);
  const shiftedStartFrame = shiftFrame(segment.startFrame);
  const shiftedEndFrame = shiftFrame(segment.endFrame);

  return {
    ...segment,
    baselineValues: shiftGeneratedFrameRecord(segment.baselineValues, anchorFrame, shiftAmount),
    handles: shiftGeneratedFrameRecord(segment.handles, anchorFrame, shiftAmount) ?? {},
    initialHandles: shiftGeneratedFrameRecord(segment.initialHandles, anchorFrame, shiftAmount),
    keyFrames,
    startFrame: Math.min(shiftedStartFrame, shiftedEndFrame, ...keyFrames),
    endFrame: Math.max(shiftedStartFrame, shiftedEndFrame, ...keyFrames),
  };
};

const buildGeneratedSegmentBaselineValues = (values: MotionValue[], startFrame: number, endFrame: number) => {
  const baselineValues: Record<string, number> = {};

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const value = values[frame];

    if (isMotionNumber(value)) {
      baselineValues[frame.toString()] = value;
    }
  }

  return baselineValues;
};

const getGeneratedSegmentBaselineValue = (
  segment: GeneratedSegment,
  values: MotionValue[],
  frame: number,
) => {
  const baselineValue = segment.baselineValues?.[frame.toString()];

  return isMotionNumber(baselineValue) ? baselineValue : values[frame];
};

// x(t)가 단조증가인 베지어에서 targetX에 대응하는 t를 이분탐색으로 역산 (weighted tangent의 시간 성분 반영용)
const solveBezierTimeForX = (x0: number, x1: number, x2: number, x3: number, targetX: number) => {
  let low = 0;
  let high = 1;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const mid = (low + high) / 2;
    if (cubicBezierPoint(x0, x1, x2, x3, mid) < targetX) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
};

const computeHandleCurveValue = (
  frame: number,
  startFrame: number,
  endFrame: number,
  startValue: number,
  endValue: number,
  startHandle: GeneratedHandlePosition,
  endHandle: GeneratedHandlePosition,
) => {
  const frameSpan = Math.max(endFrame - startFrame, 1);
  // 컨트롤 x가 구간 안에 있으면 x(t) 단조가 보장되므로 길이는 구간 전체(1.0×span)까지 허용
  const startLength = clamp(startHandle.rightLength, 0.1, frameSpan);
  const endLength = clamp(endHandle.leftLength, 0.1, frameSpan);
  const startControlFrame = startFrame + startLength;
  const endControlFrame = endFrame - endLength;
  const startControlValue =
    startValue + handleAngleToSlope(startHandle.rightAngle ?? startHandle.angle) * framesToSeconds(startLength);
  const endControlValue = endValue - handleAngleToSlope(endHandle.angle) * framesToSeconds(endLength);
  const t = solveBezierTimeForX(
    startFrame,
    startControlFrame,
    endControlFrame,
    endFrame,
    clamp(frame, startFrame, endFrame),
  );

  return cubicBezierPoint(startValue, startControlValue, endControlValue, endValue, t);
};

const applyGeneratedSegmentHandlesToValues = (values: MotionValue[], segment: GeneratedSegment): MotionValue[] => {
  if (segment.mode === "linear" || segment.keyFrames.length < 2) return values;

  const nextValues = [...values];
  const keyFrames = [...segment.keyFrames].sort((left, right) => left - right);
  const initialHandles = segment.initialHandles ?? null;
  const hasBaselineValues = segment.baselineValues !== undefined;

  for (let keyIndex = 0; keyIndex < keyFrames.length - 1; keyIndex += 1) {
    const startFrame = keyFrames[keyIndex];
    const endFrame = keyFrames[keyIndex + 1];
    const startValue = getGeneratedSegmentBaselineValue(segment, nextValues, startFrame);
    const endValue = getGeneratedSegmentBaselineValue(segment, nextValues, endFrame);

    if (!isMotionNumber(startValue) || !isMotionNumber(endValue) || endFrame <= startFrame) continue;

    const startHandle =
      segment.handles[startFrame.toString()] ?? buildDefaultGeneratedHandlePosition(nextValues, keyFrames, startFrame);
    const endHandle =
      segment.handles[endFrame.toString()] ?? buildDefaultGeneratedHandlePosition(nextValues, keyFrames, endFrame);
    const initialStartHandle =
      initialHandles?.[startFrame.toString()] ?? buildDefaultGeneratedHandlePosition(nextValues, keyFrames, startFrame);
    const initialEndHandle =
      initialHandles?.[endFrame.toString()] ?? buildDefaultGeneratedHandlePosition(nextValues, keyFrames, endFrame);

    if (!startHandle || !endHandle || !initialStartHandle || !initialEndHandle) continue;

    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      const editedValue = computeHandleCurveValue(
        frame,
        startFrame,
        endFrame,
        startValue,
        endValue,
        startHandle,
        endHandle,
      );

      if (!hasBaselineValues) {
        nextValues[frame] = editedValue;
        continue;
      }

      const baselineValue = getGeneratedSegmentBaselineValue(segment, values, frame);
      if (!isMotionNumber(baselineValue)) continue;

      const initialValue = computeHandleCurveValue(
        frame,
        startFrame,
        endFrame,
        startValue,
        endValue,
        initialStartHandle,
        initialEndHandle,
      );

      nextValues[frame] = baselineValue + (editedValue - initialValue);
    }
  }

  return nextValues;
};

const applyLinearGeneratedSegmentToValues = (values: MotionValue[], segment: GeneratedSegment): MotionValue[] => {
  const nextValues = [...values];
  const keyFrames = [...segment.keyFrames].sort((left, right) => left - right);

  for (let keyIndex = 0; keyIndex < keyFrames.length - 1; keyIndex += 1) {
    const startFrame = keyFrames[keyIndex];
    const endFrame = keyFrames[keyIndex + 1];
    const startValue = nextValues[startFrame];
    const endValue = nextValues[endFrame];

    if (!isMotionNumber(startValue) || !isMotionNumber(endValue) || endFrame <= startFrame) continue;

    const frameSpan = endFrame - startFrame;
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      const ratio = (frame - startFrame) / frameSpan;
      nextValues[frame] = startValue + (endValue - startValue) * ratio;
    }
  }

  return nextValues;
};

const applyGeneratedSegmentToValues = (values: MotionValue[], segment: GeneratedSegment): MotionValue[] =>
  segment.mode === "linear"
    ? applyLinearGeneratedSegmentToValues(values, segment)
    : applyGeneratedSegmentHandlesToValues(values, segment);

const regenerateGeneratedSegmentValues = (values: MotionValue[], segment: GeneratedSegment): MotionValue[] => {
  const nextValues = [...values];
  const keyFrames = [...segment.keyFrames].sort((left, right) => left - right);

  if (keyFrames.length < 2) return nextValues;

  if (segment.mode === "spline") {
    const nodeValues = keyFrames.map((frame) => {
      const value = nextValues[frame];
      return isMotionNumber(value) ? value : 0;
    });
    const tangentScale = 1 - DEFAULT_SPLINE_TENSION;

    for (let keyIndex = 0; keyIndex < keyFrames.length - 1; keyIndex += 1) {
      const startFrame = keyFrames[keyIndex];
      const endFrame = keyFrames[keyIndex + 1];
      const previousFrame = keyFrames[keyIndex - 1] ?? startFrame;
      const nextFrame = keyFrames[keyIndex + 2] ?? endFrame;
      const startValue = nodeValues[keyIndex];
      const endValue = nodeValues[keyIndex + 1];
      const previousValue = nodeValues[keyIndex - 1] ?? startValue;
      const nextValue = nodeValues[keyIndex + 2] ?? endValue;
      const frameSpan = endFrame - startFrame;

      if (frameSpan <= 0) continue;

      const startSlope =
        keyIndex > 0
          ? (endValue - previousValue) / Math.max(endFrame - previousFrame, 1)
          : (endValue - startValue) / frameSpan;
      const endSlope =
        keyIndex < keyFrames.length - 2
          ? (nextValue - startValue) / Math.max(nextFrame - startFrame, 1)
          : (endValue - startValue) / frameSpan;
      const scaledStartSlope = startSlope * tangentScale;
      const scaledEndSlope = endSlope * tangentScale;

      for (let frame = startFrame; frame <= endFrame; frame += 1) {
        const t = (frame - startFrame) / frameSpan;
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        nextValues[frame] =
          h00 * startValue + h10 * frameSpan * scaledStartSlope + h01 * endValue + h11 * frameSpan * scaledEndSlope;
      }
    }

    return nextValues;
  }

  for (let keyIndex = 0; keyIndex < keyFrames.length - 1; keyIndex += 1) {
    const startFrame = keyFrames[keyIndex];
    const endFrame = keyFrames[keyIndex + 1];
    const startValue = nextValues[startFrame];
    const endValue = nextValues[endFrame];

    if (!isMotionNumber(startValue) || !isMotionNumber(endValue) || endFrame <= startFrame) continue;

    const frameSpan = endFrame - startFrame;
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      const ratio = (frame - startFrame) / frameSpan;
      const interpolationRatio = segment.mode === "linear" ? ratio : buildInterpolationRatio(ratio, segment.mode);

      nextValues[frame] = startValue + (endValue - startValue) * interpolationRatio;
    }
  }

  return nextValues;
};

const buildGeneratedSegmentWithKeyFrame = (
  segment: GeneratedSegment,
  values: MotionValue[],
  frame: number,
): GeneratedSegment | null => {
  const value = values[frame];
  if (!isMotionNumber(value) || frame < segment.startFrame || frame > segment.endFrame) return null;

  const keyFrames = [...new Set([...segment.keyFrames, frame])].sort((left, right) => left - right);
  const regeneratedValues = regenerateGeneratedSegmentValues(values, { ...segment, keyFrames });
  const handles = buildGeneratedSegmentHandles(regeneratedValues, keyFrames, segment.mode);

  return {
    ...segment,
    baselineValues: buildGeneratedSegmentBaselineValues(regeneratedValues, segment.startFrame, segment.endFrame),
    handles,
    initialHandles: cloneGeneratedHandles(handles),
    keyFrames,
  };
};

const buildGeneratedSegmentFrameBounds = (segment: GeneratedSegment) => {
  let minFrame = segment.startFrame;
  let maxFrame = segment.endFrame;

  if (segment.mode !== "linear") {
    segment.keyFrames.forEach((frame) => {
      const handle = segment.handles[frame.toString()];

      if (!handle) return;

      minFrame = Math.min(minFrame, frame - handle.leftLength);
      maxFrame = Math.max(maxFrame, frame + handle.rightLength);
    });
  }

  return { minFrame, maxFrame };
};

const buildFreeVisibleRange = (start: number, span: number): VisibleRange => {
  const nextSpan = clamp(span, 1, 100000);

  return {
    start,
    end: start + nextSpan,
  };
};

const buildSelectionRect = (selection: BoxSelectState): SelectionRect => ({
  left: Math.min(selection.startX, selection.currentX),
  top: Math.min(selection.startY, selection.currentY),
  width: Math.abs(selection.currentX - selection.startX),
  height: Math.abs(selection.currentY - selection.startY),
});

const nodeKey = (node: SelectedNode) => `${node.axisIndex}:${node.frame}`;

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
const generatedSegmentKey = (segment: GeneratedSegment) => `${segment.id}`;

const getSegmentContextMenuPosition = (clientX: number, clientY: number) => ({
  x: Math.max(6, Math.min(clientX, window.innerWidth - 128)),
  y: Math.max(6, Math.min(clientY, window.innerHeight - 88)),
});

const sortAxesForRendering = (axes: MotionAxis[], selectedAxis: number | null) =>
  selectedAxis === null
    ? axes
    : [
        ...axes.filter((axis) => axis.index !== selectedAxis),
        ...axes.filter((axis) => axis.index === selectedAxis),
      ];

export function GraphEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryImportInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const plotSurfaceRef = useRef<HTMLDivElement>(null);
  const playheadDragRef = useRef(false);
  const playbackRangeDragRef = useRef<{ edge: "start" | "end"; moved: boolean } | null>(null);
  const kKeyRef = useRef(false);
  const boxSelectRef = useRef<BoxSelectState | null>(null);
  const nodeValueDragRef = useRef<NodeValueDragState | null>(null);
  const nodeFrameDragRef = useRef<NodeFrameDragState | null>(null);
  const regionScaleDragRef = useRef<RegionScaleDragState | null>(null);
  const snapValuesRef = useRef(false);
  const justDraggedNodeFrameRef = useRef(false);
  const generatedHandleDragRef = useRef<GeneratedHandleDragState | null>(null);
  const generatedSegmentIdRef = useRef(0);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const [fileName, setFileName] = useState("");
  const [axes, setAxes] = useState<MotionAxis[]>([]);
  const [generatedSegments, setGeneratedSegments] = useState<GeneratedSegment[]>([]);
  const [selectedGeneratedSegmentKey, setSelectedGeneratedSegmentKey] = useState<string | null>(null);
  const [selectedGeneratedHandle, setSelectedGeneratedHandle] = useState<SelectedGeneratedHandle | null>(null);
  const [selectedAxis, setSelectedAxis] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<SelectedNode[]>([]);
  const [nodeSelectionKind, setNodeSelectionKind] = useState<NodeSelectionKind>(null);
  const [error, setError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(DEFAULT_CURRENT_FRAME);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: DEFAULT_TIMELINE_MAX_FRAME });
  const [playbackRange, setPlaybackRange] = useState<VisibleRange>({ start: 0, end: DEFAULT_TIMELINE_MAX_FRAME });
  const [yRange, setYRange] = useState<DegreeRange>({ min: -90, max: 90 });
  const [axisInfinity, setAxisInfinity] = useState<Record<number, AxisInfinity>>({});
  const [bufferCurves, setBufferCurves] = useState<Record<number, MotionValue[]>>({});
  const [showBufferCurves, setShowBufferCurves] = useState(true);
  const [hiddenAxes, setHiddenAxes] = useState<Set<number>>(new Set());
  const [isolateSelectedAxis, setIsolateSelectedAxis] = useState(false);
  const [snapValues, setSnapValues] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingNodeValue, setIsDraggingNodeValue] = useState(false);
  const [isDraggingGeneratedHandle, setIsDraggingGeneratedHandle] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [generationMenu, setGenerationMenu] = useState<GenerationMenuState | null>(null);
  const [segmentContextMenu, setSegmentContextMenu] = useState<SegmentContextMenuState | null>(null);
  const [nodeRangeContextMenu, setNodeRangeContextMenu] = useState<NodeRangeContextMenuState | null>(null);
  const [axisContextMenu, setAxisContextMenu] = useState<AxisContextMenuState | null>(null);
  const [axisRenameDialog, setAxisRenameDialog] = useState<AxisRenameDialogState | null>(null);
  const [copiedAxis, setCopiedAxis] = useState<CopiedAxis | null>(null);
  const [copiedGeneratedSegment, setCopiedGeneratedSegment] = useState<CopiedGeneratedSegment | null>(null);
  const [copiedNodeRange, setCopiedNodeRange] = useState<CopiedNodeRange | null>(null);
  const [nodeRangePasteMode, setNodeRangePasteMode] = useState<"merge" | "insert" | "replace">("merge");
  const [saveGapDialog, setSaveGapDialog] = useState<SaveGapDialogState | null>(null);
  const [saveGapMode, setSaveGapMode] = useState<MissingValueSaveStrategy>("linear");
  const [savePendingDestination, setSavePendingDestination] = useState<SaveDestination>("client");
  const [serverRelativePath, setServerRelativePath] = useState<string | null>(null);
  const [serverBrowser, setServerBrowser] = useState<ServerBrowserState | null>(null);
  const [serverSaveAsDialog, setServerSaveAsDialog] = useState<ServerSaveAsState | null>(null);
  const [nodeDegreeInput, setNodeDegreeInput] = useState("0");
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const createEditorSnapshot = (): EditorSnapshot => ({
    axes: cloneMotionAxes(axes),
    axisInfinity: { ...axisInfinity },
    bufferCurves: { ...bufferCurves },
    currentFrame,
    error,
    fileName,
    generatedSegmentId: generatedSegmentIdRef.current,
    generatedSegments: cloneGeneratedSegments(generatedSegments),
    nodeDegreeInput,
    nodeSelectionKind,
    playbackRange: { ...playbackRange },
    selectedAxis,
    selectedGeneratedHandle: cloneSelectedGeneratedHandle(selectedGeneratedHandle),
    selectedGeneratedSegmentKey,
    selectedNode: cloneSelectedNode(selectedNode),
    selectedNodes: cloneSelectedNodes(selectedNodes),
    visibleRange: { ...visibleRange },
    yRange: { ...yRange },
  });

  const restoreEditorSnapshot = (snapshot: EditorSnapshot) => {
    setAxes(cloneMotionAxes(snapshot.axes));
    setAxisInfinity({ ...snapshot.axisInfinity });
    setBufferCurves({ ...snapshot.bufferCurves });
    setGeneratedSegments(cloneGeneratedSegments(snapshot.generatedSegments));
    generatedSegmentIdRef.current = snapshot.generatedSegmentId;
    setFileName(snapshot.fileName);
    setError(snapshot.error);
    setSelectedGeneratedSegmentKey(snapshot.selectedGeneratedSegmentKey);
    setSelectedGeneratedHandle(cloneSelectedGeneratedHandle(snapshot.selectedGeneratedHandle));
    setSelectedAxis(snapshot.selectedAxis);
    setSelectedNode(cloneSelectedNode(snapshot.selectedNode));
    setSelectedNodes(cloneSelectedNodes(snapshot.selectedNodes));
    setNodeSelectionKind(snapshot.nodeSelectionKind);
    setCurrentFrame(snapshot.currentFrame);
    setVisibleRange({ ...snapshot.visibleRange });
    setPlaybackRange({ ...snapshot.playbackRange });
    setYRange({ ...snapshot.yRange });
    // nodeDegreeInput은 타이핑 중 즉시 갱신되는 draft 텍스트라, blur 커밋 전에 push된
    // undo 스냅샷의 텍스트는 이미 새 값으로 앞서가 있을 수 있다. 복원 시에는 스냅샷에 저장된
    // selectedNode가 가리키는 실제 axes 값에서 다시 계산해 화면과 데이터가 어긋나지 않게 한다.
    const restoredNode = snapshot.selectedNode;
    const restoredAxis = restoredNode ? snapshot.axes.find((axis) => axis.index === restoredNode.axisIndex) : undefined;
    const restoredValue = restoredNode ? restoredAxis?.values[restoredNode.frame] : undefined;
    setNodeDegreeInput(isMotionNumber(restoredValue) ? formatStatNumber(restoredValue) : snapshot.nodeDegreeInput);
    setSelectionRect(null);
    setGenerationMenu(null);
    setSegmentContextMenu(null);
    setNodeRangeContextMenu(null);
    setAxisContextMenu(null);
    setAxisRenameDialog(null);
    setSaveGapDialog(null);
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [...undoStackRef.current, createEditorSnapshot()].slice(-MAX_UNDO_HISTORY);
    redoStackRef.current = [];
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(0);
  };

  const undoLastEdit = () => {
    const snapshot = undoStackRef.current.at(-1);
    if (!snapshot) return;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, createEditorSnapshot()].slice(-MAX_UNDO_HISTORY);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    restoreEditorSnapshot(snapshot);
  };

  const redoLastEdit = () => {
    const snapshot = redoStackRef.current.at(-1);
    if (!snapshot) return;

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, createEditorSnapshot()].slice(-MAX_UNDO_HISTORY);
    setRedoDepth(redoStackRef.current.length);
    setUndoDepth(undoStackRef.current.length);
    restoreEditorSnapshot(snapshot);
  };

  const frameCount = useMemo(() => getMotionFrameCount(axes), [axes]);
  const maxFrameIndex = Math.max(0, frameCount - 1);
  const visibleFrameSpan = Math.max(visibleRange.end - visibleRange.start, 1);
  const timelineMaxIndex = Math.max(
    DEFAULT_TIMELINE_MAX_FRAME,
    maxFrameIndex,
    currentFrame,
    Math.ceil(visibleRange.end),
  );
  const displayedCurrentFrame = clamp(Math.round(currentFrame), 0, timelineMaxIndex);
  const playheadPosition = clamp(((displayedCurrentFrame - visibleRange.start) / visibleFrameSpan) * 100, 0, 100);
  const isPlayheadVisible =
    displayedCurrentFrame >= visibleRange.start && displayedCurrentFrame <= visibleRange.end;
  const playbackRangeStartPct = clamp(
    ((playbackRange.start - visibleRange.start) / visibleFrameSpan) * 100,
    0,
    100,
  );
  const playbackRangeEndPct = clamp(((playbackRange.end - visibleRange.start) / visibleFrameSpan) * 100, 0, 100);
  const isPlaybackRangeVisible = playbackRange.end >= visibleRange.start && playbackRange.start <= visibleRange.end;
  const isPlayheadAtOtherAxisRightEdge =
    selectedAxis !== null &&
    axes.some(
      (axis) =>
        axis.index !== selectedAxis &&
        getLastMotionValueFrame(axis.values) === displayedCurrentFrame,
    );
  const playheadRulerClassName = [
    "playheadRulerMarker",
    isDraggingPlayhead ? "active" : "",
    isPlayheadAtOtherAxisRightEdge ? "otherAxisEnd" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const playheadOverlayClassName = [
    "playheadOverlay",
    isDraggingPlayhead ? "active" : "",
    isPlayheadAtOtherAxisRightEdge ? "otherAxisEnd" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const frameMarks = useMemo(() => buildFrameMarks(visibleRange), [visibleRange]);
  const yMarks = useMemo(() => buildYMarks(yRange.min, yRange.max), [yRange]);
  const renderedAxes = useMemo(() => sortAxesForRendering(axes, selectedAxis), [axes, selectedAxis]);
  const selectedAxisRecord = useMemo(
    () => (selectedAxis === null ? null : axes.find((axis) => axis.index === selectedAxis) ?? null),
    [axes, selectedAxis],
  );
  const selectedAxisNodePoints = useMemo(() => {
    if (!selectedAxisRecord) return [];

    return toPlotPoints(selectedAxisRecord.values, visibleRange, yRange.min, yRange.max);
  }, [selectedAxisRecord, visibleRange, yRange.min, yRange.max]);
  const disconnectedFrameSet = useMemo(
    () => (selectedAxisRecord ? buildDisconnectedFrameSet(selectedAxisRecord.values) : new Set<number>()),
    [selectedAxisRecord],
  );
  const shouldShowAllNodeMarkers = visibleFrameSpan <= SHOW_ALL_NODE_MARKERS_VISIBLE_SPAN;
  const nodeMarkerSize = clamp(
    (108 * NODE_MARKER_SIZE_SCALE) / Math.sqrt(visibleFrameSpan),
    3.75 * NODE_MARKER_SIZE_SCALE,
    21 * NODE_MARKER_SIZE_SCALE,
  );
  const selectedNodeKeys = useMemo(() => new Set(selectedNodes.map(nodeKey)), [selectedNodes]);
  const primarySelectedNodeKey = selectedNode ? nodeKey(selectedNode) : null;
  const selectedAxisStats = useMemo(
    () =>
      selectedAxisRecord
        ? buildAxisStats(selectedAxisRecord, selectedAxisNodePoints.length, selectedNode)
        : null,
    [selectedAxisRecord, selectedAxisNodePoints.length, selectedNode],
  );
  const selectedAxisDisplayName = formatAxisDisplayName(selectedAxisRecord);
  const selectedAxisNodeSelection = selectedNodes.filter((node) => node.axisIndex === selectedAxisRecord?.index);
  const activeSelectedNodes =
    selectedAxisRecord && selectedAxisNodeSelection.length > 0
      ? selectedAxisNodeSelection
      : selectedAxisRecord && selectedNode?.axisIndex === selectedAxisRecord.index
        ? [selectedNode]
        : [];
  const activeGeneratedSegments = useMemo(
    () => [...generatedSegments].sort((left, right) => left.id - right.id),
    [generatedSegments],
  );
  const selectedGeneratedSegment = useMemo(
    () => generatedSegments.find((segment) => generatedSegmentKey(segment) === selectedGeneratedSegmentKey) ?? null,
    [generatedSegments, selectedGeneratedSegmentKey],
  );
  // Maya Region(Scale Keys) 도구: 2개 이상 키 선택 시 스케일 박스의 데이터 좌표 경계.
  const regionScaleBounds = useMemo(() => {
    if (!selectedAxisRecord || selectedGeneratedSegment) return null;

    const nodes = selectedNodes.filter((node) => node.axisIndex === selectedAxisRecord.index);
    if (nodes.length < 2) return null;

    let minFrame = Infinity;
    let maxFrame = -Infinity;
    let minValue = Infinity;
    let maxValue = -Infinity;

    nodes.forEach((node) => {
      const value = selectedAxisRecord.values[node.frame];
      if (!isMotionNumber(value)) return;

      minFrame = Math.min(minFrame, node.frame);
      maxFrame = Math.max(maxFrame, node.frame);
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    });

    if (!Number.isFinite(minFrame) || maxFrame <= minFrame) return null;

    return { minFrame, maxFrame, minValue, maxValue };
  }, [selectedAxisRecord, selectedGeneratedSegment, selectedNodes]);
  const regionScaleYSpan = Math.max(yRange.max - yRange.min, 0.0001);
  const regionScaleRect = regionScaleBounds
    ? {
        left: ((regionScaleBounds.minFrame - visibleRange.start) / visibleFrameSpan) * 100,
        top: 92 - ((regionScaleBounds.maxValue - yRange.min) / regionScaleYSpan) * 84,
        width: ((regionScaleBounds.maxFrame - regionScaleBounds.minFrame) / visibleFrameSpan) * 100,
        height: ((regionScaleBounds.maxValue - regionScaleBounds.minValue) / regionScaleYSpan) * 84,
        hasValueSpan: regionScaleBounds.maxValue - regionScaleBounds.minValue > 1e-9,
      }
    : null;
  const selectedAxisInfinity =
    (selectedAxisRecord ? axisInfinity[selectedAxisRecord.index] : undefined) ?? DEFAULT_AXIS_INFINITY;
  // Pre/Post Infinity 점선 프리뷰: 선택 축의 데이터 범위 밖 뷰포트 구간을 모드에 따라 평가.
  const infinityPreview = useMemo(() => {
    if (!selectedAxisRecord) return null;

    const modes = axisInfinity[selectedAxisRecord.index] ?? DEFAULT_AXIS_INFINITY;
    if (modes.pre === "constant" && modes.post === "constant") return null;

    const values = selectedAxisRecord.values;
    const firstFrame = getFirstMotionValueFrame(values);
    const lastFrame = getLastMotionValueFrame(values);
    if (firstFrame === null || lastFrame === null) return null;

    const visibleSpan = Math.max(visibleRange.end - visibleRange.start, 1);
    const ySpan = Math.max(yRange.max - yRange.min, 1);
    const stride = Math.max(1, Math.ceil(visibleSpan / 4000));
    const toPoint = (frame: number, value: number) =>
      `${((frame - visibleRange.start) / visibleSpan) * 100},${92 - ((value - yRange.min) / ySpan) * 84}`;

    const buildSide = (mode: InfinityMode, fromFrame: number, toFrame: number) => {
      if (mode === "constant" || toFrame < fromFrame) return null;

      const points: string[] = [];
      for (let frame = fromFrame; frame <= toFrame; frame += stride) {
        const value = evaluateInfinityFrame(values, firstFrame, lastFrame, frame, mode);
        if (isMotionNumber(value)) points.push(toPoint(frame, value));
      }

      return points.length >= 2 ? points.join(" ") : null;
    };

    const prePoints = buildSide(
      modes.pre,
      Math.max(Math.floor(visibleRange.start) - 1, 0),
      Math.min(firstFrame, Math.ceil(visibleRange.end) + 1),
    );
    const postPoints = buildSide(
      modes.post,
      Math.max(lastFrame, Math.floor(visibleRange.start) - 1),
      Math.ceil(visibleRange.end) + 1,
    );

    if (!prePoints && !postPoints) return null;

    return { prePoints, postPoints };
  }, [selectedAxisRecord, axisInfinity, visibleRange, yRange]);
  // Maya Buffer Curve: 선택 축의 버퍼 스냅샷을 회색 고스트 폴리라인으로 표시.
  const bufferCurvePolylines = useMemo(() => {
    if (!showBufferCurves || !selectedAxisRecord) return [];

    const buffered = bufferCurves[selectedAxisRecord.index];
    if (!buffered) return [];

    return toPlotSegments(buffered, visibleRange, yRange.min, yRange.max).map((points) => toPolyline(points));
  }, [showBufferCurves, selectedAxisRecord, bufferCurves, visibleRange, yRange]);
  const copiedGeneratedSegmentPasteTarget = (() => {
    const targetNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;

    if (!copiedGeneratedSegment || !selectedAxisRecord || !targetNode) return null;
    if (targetNode.axisIndex !== selectedAxisRecord.index) return null;

    const startValue = selectedAxisRecord.values[targetNode.frame];
    if (!isMotionNumber(startValue)) return null;

    const endFrame = targetNode.frame + copiedGeneratedSegment.duration;

    for (let frame = targetNode.frame + 1; frame <= endFrame; frame += 1) {
      if (isMotionNumber(selectedAxisRecord.values[frame])) {
        return null;
      }
    }

    return {
      axis: selectedAxisRecord,
      endFrame,
      startFrame: targetNode.frame,
      startValue,
    };
  })();
  // 붙여넣기 대상 후보: 컨텍스트 메뉴를 열지 결정하는 용도라 Merge의 "빈 공간 필요" 제약은 넣지 않는다.
  const copiedNodeRangeCandidateTarget = (() => {
    const targetNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;

    if (!copiedNodeRange || !selectedAxisRecord || !targetNode) return null;
    if (targetNode.axisIndex !== selectedAxisRecord.index) return null;

    const startValue = selectedAxisRecord.values[targetNode.frame];
    if (!isMotionNumber(startValue)) return null;

    return {
      axis: selectedAxisRecord,
      endFrame: targetNode.frame + copiedNodeRange.duration,
      startFrame: targetNode.frame,
      startValue,
    };
  })();
  // 실제 Paste 버튼 활성화·붙여넣기에 쓰는 대상: 모드별 유효성(Merge는 빈 공간 필요)까지 반영한다.
  const copiedNodeRangePasteTarget = (() => {
    if (!copiedNodeRangeCandidateTarget || !copiedNodeRange || !selectedAxisRecord) return null;

    const { startFrame } = copiedNodeRangeCandidateTarget;
    const lastFrame = getLastMotionValueFrame(selectedAxisRecord.values);
    // Insert/Replace 모드는 기존 데이터를 밀어내거나 지우고 붙여넣으므로 빈 공간일 필요가 없다.
    const hasRightSpace =
      nodeRangePasteMode !== "merge" ||
      lastFrame === startFrame ||
      copiedNodeRange.nodes.every(({ offset }) => {
        const frame = startFrame + offset;

        return offset === 0 || !isMotionNumber(selectedAxisRecord.values[frame]);
      });

    return hasRightSpace ? copiedNodeRangeCandidateTarget : null;
  })();
  const nodeDegreeValue = Number(nodeDegreeInput);
  const isNodeDegreeInputValid = nodeDegreeInput.trim().length > 0 && Number.isFinite(nodeDegreeValue);
  const canAddNode =
    selectedGeneratedSegment === null &&
    selectedAxisRecord !== null &&
    activeSelectedNodes.length <= 1 &&
    isNodeDegreeInputValid;
  const hasRemovableNodeSelection = activeSelectedNodes.length > 0 && nodeSelectionKind !== "ctrl";
  const canDeleteNode =
    hasRemovableNodeSelection || (selectedGeneratedSegment !== null && activeSelectedNodes.length === 0);
  const canCutSelectedAxis = selectedAxisRecord !== null;
  const selectedShiftNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;
  const canShiftNode =
    selectedGeneratedSegment === null &&
    selectedAxisRecord !== null &&
    selectedShiftNode?.axisIndex === selectedAxisRecord.index &&
    isMotionNumber(selectedAxisRecord.values[selectedShiftNode.frame]);
  const isLinearSelectionOrdered = activeSelectedNodes.every(
    (node, nodeIndex) => nodeIndex === 0 || node.frame > activeSelectedNodes[nodeIndex - 1].frame,
  );
  const hasLinearEndpointValues =
    selectedAxisRecord !== null &&
    activeSelectedNodes.every((node) => isMotionNumber(selectedAxisRecord.values[node.frame]));
  const canGenerateSegment =
    selectedAxisRecord !== null &&
    activeSelectedNodes.length >= 2 &&
    nodeSelectionKind === "ctrl" &&
    isLinearSelectionOrdered &&
    hasLinearEndpointValues;
  const splineSelectedFrameGaps = activeSelectedNodes
    .slice(1)
    .map((node, nodeIndex) => node.frame - activeSelectedNodes[nodeIndex].frame);
  const canGenerateSpline =
    selectedAxisRecord !== null &&
    activeSelectedNodes.length >= 3 &&
    isLinearSelectionOrdered &&
    hasLinearEndpointValues &&
    splineSelectedFrameGaps.every((gap) => gap >= DEFAULT_SPLINE_MIN_GAP);
  const canGenerateMode = (mode: GeneratedSegmentMode) => (mode === "spline" ? canGenerateSpline : canGenerateSegment);
  const generatedKeyHandles = useMemo(() => {
    if (
      !selectedAxisRecord ||
      !selectedGeneratedSegment ||
      selectedGeneratedSegment.axisIndex !== selectedAxis ||
      selectedGeneratedSegment.mode === "linear" ||
      selectedGeneratedSegment.mode === "stepped"
    ) {
      return new Map<number, GeneratedHandleRenderData>();
    }

    const keyFrames = selectedGeneratedSegment.keyFrames ?? [
      selectedGeneratedSegment.startFrame,
      selectedGeneratedSegment.endFrame,
    ];
    const nextHandles = new Map<number, GeneratedHandleRenderData>();

    keyFrames.forEach((frame) => {
      const value = selectedAxisRecord.values[frame];
      const handle =
        selectedGeneratedSegment.handles[frame.toString()] ??
        buildDefaultGeneratedHandlePosition(selectedAxisRecord.values, keyFrames, frame);

      if (!isMotionNumber(value) || !handle) return;

      const leftSlope = handleAngleToSlope(handle.angle);
      const rightSlope = handleAngleToSlope(handle.rightAngle ?? handle.angle);
      const leftFrame = frame - handle.leftLength;
      const rightFrame = frame + handle.rightLength;
      const leftValue = value - leftSlope * framesToSeconds(handle.leftLength);
      const rightValue = value + rightSlope * framesToSeconds(handle.rightLength);

      nextHandles.set(frame, {
        center: toPlotPosition(frame, value, visibleRange, yRange.min, yRange.max),
        left: toPlotPosition(leftFrame, leftValue, visibleRange, yRange.min, yRange.max),
        right: toPlotPosition(rightFrame, rightValue, visibleRange, yRange.min, yRange.max),
      });
    });

    return nextHandles;
  }, [selectedAxis, selectedAxisRecord, selectedGeneratedSegment, visibleRange, yRange.max, yRange.min]);
  const renderedSelectedAxisNodePoints = useMemo(() => {
    if (shouldShowAllNodeMarkers || selectedAxis === null) return selectedAxisNodePoints;

    return selectedAxisNodePoints.filter((point) => {
      const currentNodeKey = nodeKey({ axisIndex: selectedAxis, frame: point.frame });

      return (
        disconnectedFrameSet.has(point.frame) ||
        generatedKeyHandles.has(point.frame) ||
        primarySelectedNodeKey === currentNodeKey ||
        selectedNodeKeys.has(currentNodeKey)
      );
    });
  }, [
    disconnectedFrameSet,
    generatedKeyHandles,
    primarySelectedNodeKey,
    selectedAxis,
    selectedAxisNodePoints,
    selectedNodeKeys,
    shouldShowAllNodeMarkers,
  ]);
  const selectedGeneratedHandleSegment = useMemo(
    () =>
      selectedGeneratedHandle
        ? generatedSegments.find((segment) => segment.id === selectedGeneratedHandle.segmentId) ?? null
        : null,
    [generatedSegments, selectedGeneratedHandle],
  );
  const selectedGeneratedHandlePosition =
    selectedGeneratedHandle && selectedGeneratedHandleSegment
      ? selectedGeneratedHandleSegment.handles[selectedGeneratedHandle.frame.toString()] ?? null
      : null;
  const isSelectedGeneratedHandleBroken = selectedGeneratedHandlePosition?.rightAngle !== undefined;
  const syncNodeDegreeInput = (value: MotionValue | undefined) => {
    if (isMotionNumber(value)) {
      setNodeDegreeInput(formatStatNumber(value));
    }
  };

  const updateNodeValue = (axisIndex: number, frame: number, value: number) => {
    if (
      selectedGeneratedSegment &&
      selectedGeneratedSegment.axisIndex === axisIndex &&
      frame >= selectedGeneratedSegment.startFrame &&
      frame <= selectedGeneratedSegment.endFrame
    ) {
      const axis = axes.find((candidate) => candidate.index === axisIndex);
      if (axis) {
        const nextValues = [...axis.values];
        while (nextValues.length <= frame) {
          nextValues.push(null);
        }
        nextValues[frame] = value;

        const nextSegment = buildGeneratedSegmentWithKeyFrame(selectedGeneratedSegment, nextValues, frame);

        if (nextSegment) {
          const appliedValues = applyGeneratedSegmentToValues(nextValues, nextSegment);

          setAxes((current) =>
            current.map((currentAxis) =>
              currentAxis.index === axisIndex
                ? {
                    ...currentAxis,
                    values: appliedValues,
                  }
                : currentAxis,
            ),
          );
          setGeneratedSegments((current) =>
            current.map((segment) => (segment.id === nextSegment.id ? nextSegment : segment)),
          );
          setNodeDegreeInput(formatStatNumber(value));
          return;
        }
      }
    }

    setAxes((current) =>
      current.map((axis) => {
        if (axis.index !== axisIndex) return axis;

        const nextValues = [...axis.values];
        while (nextValues.length <= frame) {
          nextValues.push(null);
        }
        nextValues[frame] = value;

        return { ...axis, values: nextValues };
      }),
    );
    setNodeDegreeInput(formatStatNumber(value));
  };

  const selectGeneratedSegment = (segment: GeneratedSegment) => {
    const segmentKey = generatedSegmentKey(segment);

    if (selectedGeneratedSegmentKey === segmentKey) {
      setSelectedGeneratedSegmentKey(null);
      setSelectedGeneratedHandle(null);
      return;
    }

    const segmentBounds = buildGeneratedSegmentFrameBounds(segment);
    const segmentSpan = Math.max(segmentBounds.maxFrame - segmentBounds.minFrame, 1);
    const rangePadding = Math.max(5, Math.ceil(segmentSpan * 0.12));
    const rangeSpan = Math.max(20, segmentSpan + rangePadding * 2);

    setSelectedGeneratedSegmentKey(segmentKey);
    setSelectedAxis(segment.axisIndex);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setSelectedGeneratedHandle(null);
    setCurrentFrame(segment.startFrame);
    setVisibleRange(buildFreeVisibleRange(segmentBounds.minFrame - rangePadding, rangeSpan));
  };

  const recordGeneratedSegments = (
    axisIndex: number,
    nodes: SelectedNode[],
    mode: GeneratedSegmentMode,
    sourceValues: MotionValue[],
  ) => {
    const startNode = nodes[0];
    const endNode = nodes[nodes.length - 1];

    if (!startNode || !endNode || startNode.frame === endNode.frame) return;

    generatedSegmentIdRef.current += 1;

    const keyFrames = nodes.map((node) => node.frame);
    const handles = buildGeneratedSegmentHandles(sourceValues, keyFrames, mode);
    const nextSegment = {
      baselineValues: buildGeneratedSegmentBaselineValues(sourceValues, startNode.frame, endNode.frame),
      handles,
      axisIndex,
      endFrame: endNode.frame,
      id: generatedSegmentIdRef.current,
      initialHandles: cloneGeneratedHandles(handles),
      keyFrames,
      mode,
      startFrame: startNode.frame,
    };

    setGeneratedSegments((current) => [...current, nextSegment]);
  };

  useEffect(() => {
    const handleKScrubKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" || event.key === "K") {
        if (isEditableTarget(event.target)) return;
        kKeyRef.current = true;
      }
    };
    const handleKScrubKeyUp = (event: KeyboardEvent) => {
      if (event.key === "k" || event.key === "K") {
        kKeyRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKScrubKeyDown);
    window.addEventListener("keyup", handleKScrubKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKScrubKeyDown);
      window.removeEventListener("keyup", handleKScrubKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setSelectedNode(null);
      setSelectedNodes([]);
      setNodeSelectionKind(null);
      setSelectionRect(null);
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu(null);
      setAxisContextMenu(null);
      setAxisRenameDialog(null);
      boxSelectRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!axisContextMenu && !segmentContextMenu && !nodeRangeContextMenu) return;

    const closeContextMenus = () => {
      setAxisContextMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu(null);
    };

    window.addEventListener("pointerdown", closeContextMenus);
    window.addEventListener("resize", closeContextMenus);
    window.addEventListener("scroll", closeContextMenus, true);

    return () => {
      window.removeEventListener("pointerdown", closeContextMenus);
      window.removeEventListener("resize", closeContextMenus);
      window.removeEventListener("scroll", closeContextMenus, true);
    };
  }, [axisContextMenu, nodeRangeContextMenu, segmentContextMenu]);

  const generateSegmentMotionData = (mode: SegmentInterpolationMode) => {
    if (!selectedAxisRecord || !canGenerateSegment) return;

    pushUndoSnapshot();

    const selectedAxisIndex = selectedAxisRecord.index;
    const orderedNodes = [...activeSelectedNodes];
    const nextSelectedValues = [...selectedAxisRecord.values];

    orderedNodes.forEach((node) => {
      while (nextSelectedValues.length <= node.frame) {
        nextSelectedValues.push(null);
      }
    });

    for (let nodeIndex = 0; nodeIndex < orderedNodes.length - 1; nodeIndex += 1) {
      const startNode = orderedNodes[nodeIndex];
      const endNode = orderedNodes[nodeIndex + 1];
      const startValue = nextSelectedValues[startNode.frame];
      const endValue = nextSelectedValues[endNode.frame];

      if (!isMotionNumber(startValue) || !isMotionNumber(endValue)) continue;

      const frameSpan = endNode.frame - startNode.frame;
      for (let frame = startNode.frame; frame <= endNode.frame; frame += 1) {
        const ratio = (frame - startNode.frame) / frameSpan;
        const interpolationRatio = buildInterpolationRatio(ratio, mode);
        nextSelectedValues[frame] = startValue + (endValue - startValue) * interpolationRatio;
      }
    }

    setAxes((current) =>
      current.map((axis) =>
        axis.index === selectedAxisIndex ? { ...axis, values: nextSelectedValues } : axis,
      ),
    );
    recordGeneratedSegments(selectedAxisIndex, orderedNodes, mode, nextSelectedValues);
  };

  const generateSplineMotionData = () => {
    if (!selectedAxisRecord || !canGenerateSpline) return;

    pushUndoSnapshot();

    const selectedAxisIndex = selectedAxisRecord.index;
    const orderedNodes = [...activeSelectedNodes];
    const nextSelectedValues = [...selectedAxisRecord.values];

    orderedNodes.forEach((node) => {
      while (nextSelectedValues.length <= node.frame) {
        nextSelectedValues.push(null);
      }
    });

    const nodeValues = orderedNodes.map((node) => {
      const value = nextSelectedValues[node.frame];
      return isMotionNumber(value) ? value : 0;
    });
    const tangentScale = 1 - DEFAULT_SPLINE_TENSION;

    for (let nodeIndex = 0; nodeIndex < orderedNodes.length - 1; nodeIndex += 1) {
      const startNode = orderedNodes[nodeIndex];
      const endNode = orderedNodes[nodeIndex + 1];
      const previousNode = orderedNodes[nodeIndex - 1] ?? startNode;
      const nextNode = orderedNodes[nodeIndex + 2] ?? endNode;
      const startValue = nodeValues[nodeIndex];
      const endValue = nodeValues[nodeIndex + 1];
      const previousValue = nodeValues[nodeIndex - 1] ?? startValue;
      const nextValue = nodeValues[nodeIndex + 2] ?? endValue;
      const frameSpan = endNode.frame - startNode.frame;
      const startSlope =
        nodeIndex > 0
          ? (endValue - previousValue) / Math.max(endNode.frame - previousNode.frame, 1)
          : (endValue - startValue) / frameSpan;
      const endSlope =
        nodeIndex < orderedNodes.length - 2
          ? (nextValue - startValue) / Math.max(nextNode.frame - startNode.frame, 1)
          : (endValue - startValue) / frameSpan;
      const scaledStartSlope = startSlope * tangentScale;
      const scaledEndSlope = endSlope * tangentScale;

      for (let frame = startNode.frame; frame <= endNode.frame; frame += 1) {
        const t = (frame - startNode.frame) / frameSpan;
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        nextSelectedValues[frame] =
          h00 * startValue + h10 * frameSpan * scaledStartSlope + h01 * endValue + h11 * frameSpan * scaledEndSlope;
      }
    }

    setAxes((current) =>
      current.map((axis) =>
        axis.index === selectedAxisIndex ? { ...axis, values: nextSelectedValues } : axis,
      ),
    );
    recordGeneratedSegments(selectedAxisIndex, orderedNodes, "spline", nextSelectedValues);
  };

  const generateMotionData = (mode: GeneratedSegmentMode) => {
    if (mode === "spline") {
      generateSplineMotionData();
      return;
    }

    generateSegmentMotionData(mode);
  };

  const applyLoadedCsv = (text: string, displayName: string, serverPath: string | null, metaText: string | null = null) => {
    const parsedAxes = parseMotionCsv(text);
    const nextFrameCount = parsedAxes.reduce((max, axis) => Math.max(max, axis.values.length), 0);
    const nextMaxFrame = Math.max(0, nextFrameCount - 1);
    const meta = parseMotionMeta(metaText, parsedAxes);
    const namedAxes = parsedAxes.map((axis) =>
      meta.axisNames[axis.index] !== undefined ? { ...axis, name: meta.axisNames[axis.index] } : axis,
    );

    pushUndoSnapshot();

    setFileName(displayName);
    setServerRelativePath(serverPath);
    setAxes(namedAxes);
    setAxisInfinity(meta.axisInfinity);
    setBufferCurves({});
    setHiddenAxes(new Set());
    setIsolateSelectedAxis(false);
    setGeneratedSegments(meta.generatedSegments);
    generatedSegmentIdRef.current =
      meta.generatedSegments.reduce((maxId, segment) => Math.max(maxId, segment.id), -1) + 1;
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedAxis(parsedAxes[0]?.index ?? null);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setCurrentFrame(parsedAxes.length > 0 ? clamp(DEFAULT_CURRENT_FRAME, 0, nextMaxFrame) : DEFAULT_CURRENT_FRAME);
    setError(parsedAxes.length === 0 ? "numeric row not found" : "");
    setYRange(buildDataYRange(parsedAxes));
    setVisibleRange({ start: 0, end: Math.max(nextMaxFrame, 1) });
    setPlaybackRange({ start: 0, end: Math.max(nextMaxFrame, 1) });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    // 번들(zip)이 있으면 우선 처리: csv+meta가 한 파일이라 meta 누락이 원천적으로 불가능하다.
    const bundleFile = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
    if (bundleFile) {
      const bundle = await parseMotionBundle(bundleFile);
      event.target.value = "";
      if (!bundle) {
        setError(`bundle open failed: no csv entry in ${bundleFile.name}`);
        return;
      }
      applyLoadedCsv(bundle.csvText, ensureCsvFileName(bundleFile.name.replace(/\.zip$/i, "")), null, bundle.metaText);
      return;
    }

    const csvFile = files.find((file) => file.name.toLowerCase().endsWith(".csv"));
    if (!csvFile) {
      event.target.value = "";
      return;
    }

    // CSV와 함께 사이드카 meta(.csv.meta.json)를 같이 선택하면 핸들/세그먼트를 복원한다.
    const exactMetaName = motionMetaPathFor(csvFile.name).toLowerCase();
    const metaFile =
      files.find((file) => file.name.toLowerCase() === exactMetaName) ??
      files.find((file) => file.name.toLowerCase().endsWith(".meta.json"));
    const text = await csvFile.text();
    const metaText = metaFile ? await metaFile.text() : null;
    applyLoadedCsv(text, csvFile.name, null, metaText);
    event.target.value = "";
  };

  const openServerBrowser = async () => {
    setServerBrowser({ files: [], loading: true, error: "", notice: "" });
    try {
      const res = await fetch("/api/motions");
      if (!res.ok) throw new Error(await res.text());
      const files: ServerFileEntry[] = await res.json() as ServerFileEntry[];
      setServerBrowser({ files, loading: false, error: "", notice: "" });
    } catch (err) {
      setServerBrowser({ files: [], loading: false, error: String(err), notice: "" });
    }
  };

  // 라이브러리 export: MOTION_DIR 전체(csv+meta 쌍)를 zip 하나로 다운로드 — 로컬 설치를 다른 PC로 옮길 때 사용
  const exportServerLibrary = () => {
    const downloadLink = document.createElement("a");
    downloadLink.href = "/api/motions/export";
    downloadLink.download = "";
    downloadLink.click();
  };

  // 라이브러리 import: export한 zip을 업로드해 서버 MOTION_DIR에 복원 (동일 파일명은 덮어씀)
  const handleLibraryImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setServerBrowser((current) => (current ? { ...current, loading: true, error: "", notice: "" } : current));
    try {
      const res = await fetch("/api/motions/import", {
        method: "POST",
        body: file,
        headers: { "Content-Type": "application/zip" },
      });
      const result = (await res.json()) as { error?: string; added?: string[]; overwritten?: string[] };
      if (!res.ok) throw new Error(result.error ?? "import failed");

      const listRes = await fetch("/api/motions");
      const files: ServerFileEntry[] = listRes.ok ? ((await listRes.json()) as ServerFileEntry[]) : [];
      setServerBrowser({
        files,
        loading: false,
        error: "",
        notice: `Imported — added ${result.added?.length ?? 0}, overwritten ${result.overwritten?.length ?? 0}`,
      });
    } catch (err) {
      setServerBrowser((current) =>
        current ? { ...current, loading: false, error: `Import failed: ${String(err)}` } : current,
      );
    }
  };

  const openServerFile = async (entry: ServerFileEntry) => {
    setServerBrowser(null);
    try {
      const res = await fetch(`/api/motions/file?path=${encodeURIComponent(entry.relativePath)}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      let metaText: string | null = null;
      try {
        const metaRes = await fetch(
          `/api/motions/file?path=${encodeURIComponent(motionMetaPathFor(entry.relativePath))}`,
        );
        if (metaRes.ok) metaText = await metaRes.text();
      } catch {
        // meta는 선택 사항 — 없거나 읽기 실패해도 CSV 로드는 계속한다.
      }
      applyLoadedCsv(text, entry.name, entry.relativePath, metaText);
    } catch (err) {
      setError(`Server open failed: ${String(err)}`);
    }
  };

  const writeToServer = async (targetPath: string, missingValueStrategy: MissingValueSaveStrategy) => {
    const csvContent = serializeMotionCsv(axes, missingValueStrategy);
    try {
      const res = await fetch(`/api/motions/file?path=${encodeURIComponent(targetPath)}`, {
        method: "PUT",
        body: csvContent,
        headers: { "Content-Type": "text/plain" },
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(`Server save failed: ${msg}`);
        return;
      }
      // 핸들 편집을 다시 열 수 있도록 세그먼트/Infinity/축 이름을 사이드카에 함께 저장.
      // 세그먼트가 없어도 항상 덮어써서 오래된 meta가 남지 않게 한다.
      const metaRes = await fetch(`/api/motions/file?path=${encodeURIComponent(motionMetaPathFor(targetPath))}`, {
        method: "PUT",
        body: serializeMotionMeta(axes, generatedSegments, axisInfinity),
        headers: { "Content-Type": "application/json" },
      });
      if (!metaRes.ok) {
        setError(`Server save: CSV saved, but meta save failed: ${await metaRes.text()}`);
        setServerRelativePath(targetPath);
        setFileName(targetPath.split("/").pop() ?? targetPath);
        return;
      }
      setServerRelativePath(targetPath);
      setFileName(targetPath.split("/").pop() ?? targetPath);
      setError("");
    } catch (err) {
      setError(`Server save failed: ${String(err)}`);
    }
  };

  const saveMotionCsvToServer = async (
    missingValueStrategy: MissingValueSaveStrategy = "linear",
    skipGapDialog = false,
    overridePath?: string,
  ) => {
    if (axes.length === 0) return;

    const rightmostNodeMismatch = getAxisRightmostNodeIndexMismatch(axes);
    if (rightmostNodeMismatch) {
      setSaveGapDialog(null);
      setError(
        `rightmost node index mismatch: axis ${formatAxisDisplayName(rightmostNodeMismatch.axis)} ends at ${
          rightmostNodeMismatch.actualLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.actualLastNodeIndex)
        }, expected ${
          rightmostNodeMismatch.expectedLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.expectedLastNodeIndex)
        }`,
      );
      return;
    }

    setError("");

    const gapStats = getSaveGapStats(axes);

    if (!skipGapDialog && gapStats.missingCount > 0) {
      setSavePendingDestination("server");
      setSaveGapDialog(gapStats);
      return;
    }

    setSaveGapDialog(null);

    const targetPath = overridePath ?? serverRelativePath;
    if (!targetPath) {
      setServerSaveAsDialog({ name: fileName || "motion.csv", strategy: missingValueStrategy });
      return;
    }

    await writeToServer(targetPath, missingValueStrategy);
  };

  const handleServerSaveAsConfirm = async () => {
    if (!serverSaveAsDialog) return;
    const rawName = serverSaveAsDialog.name.trim();
    if (!rawName) return;
    const csvName = rawName.toLowerCase().endsWith(".csv") ? rawName : `${rawName}.csv`;
    const strategy = serverSaveAsDialog.strategy;
    setServerSaveAsDialog(null);
    await writeToServer(csvName, strategy);
  };

  const handleGapDialogSave = () => {
    if (savePendingDestination === "server") {
      void saveMotionCsvToServer(saveGapMode, true);
    } else if (savePendingDestination === "bundle") {
      void saveMotionBundle(saveGapMode, true);
    } else {
      void saveMotionCsv(saveGapMode, true);
    }
  };

  const saveMotionCsv = async (
    missingValueStrategy: MissingValueSaveStrategy = "linear",
    skipGapDialog = false,
  ) => {
    if (axes.length === 0) return;

    const rightmostNodeMismatch = getAxisRightmostNodeIndexMismatch(axes);
    if (rightmostNodeMismatch) {
      setSaveGapDialog(null);
      setError(
        `rightmost node index mismatch: axis ${formatAxisDisplayName(rightmostNodeMismatch.axis)} ends at ${
          rightmostNodeMismatch.actualLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.actualLastNodeIndex)
        }, expected ${
          rightmostNodeMismatch.expectedLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.expectedLastNodeIndex)
        }`,
      );
      return;
    }

    setError("");

    const gapStats = getSaveGapStats(axes);

    if (!skipGapDialog && gapStats.missingCount > 0) {
      setSavePendingDestination("client");
      setSaveGapDialog(gapStats);
      return;
    }

    setSaveGapDialog(null);

    // Export CSV: 순수 CSV만 내려받는다(외부 소비자용). 편집 상태(핸들)까지 보존하려면 Save Bundle을 사용.
    const nextFileName = ensureCsvFileName(fileName || "motion.csv");
    const csvBlob = new Blob([serializeMotionCsv(axes, missingValueStrategy)], { type: "text/csv;charset=utf-8" });
    const pickerWindow = window as SaveFilePickerWindow;

    if (pickerWindow.showSaveFilePicker) {
      try {
        const fileHandle = await pickerWindow.showSaveFilePicker({
          suggestedName: nextFileName,
          types: [
            {
              accept: { "text/csv": [".csv"] },
              description: "CSV file",
            },
          ],
        });
        const writable = await fileHandle.createWritable();

        await writable.write(csvBlob);
        await writable.close();
        setFileName(nextFileName);
        return;
      } catch (saveError) {
        if (saveError instanceof DOMException && saveError.name === "AbortError") {
          return;
        }
      }
    }

    const csvUrl = URL.createObjectURL(csvBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = csvUrl;
    downloadLink.download = nextFileName;
    downloadLink.click();
    URL.revokeObjectURL(csvUrl);
    setFileName(nextFileName);
  };

  // Save Bundle: csv+meta를 zip 하나로 내려받아 다른 PC로 파일 하나만 옮기면 편집 상태까지 보존된다.
  const saveMotionBundle = async (
    missingValueStrategy: MissingValueSaveStrategy = "linear",
    skipGapDialog = false,
  ) => {
    if (axes.length === 0) return;

    const rightmostNodeMismatch = getAxisRightmostNodeIndexMismatch(axes);
    if (rightmostNodeMismatch) {
      setSaveGapDialog(null);
      setError(
        `rightmost node index mismatch: axis ${formatAxisDisplayName(rightmostNodeMismatch.axis)} ends at ${
          rightmostNodeMismatch.actualLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.actualLastNodeIndex)
        }, expected ${
          rightmostNodeMismatch.expectedLastNodeIndex === null
            ? "none"
            : formatStatNumber(rightmostNodeMismatch.expectedLastNodeIndex)
        }`,
      );
      return;
    }

    setError("");

    const gapStats = getSaveGapStats(axes);

    if (!skipGapDialog && gapStats.missingCount > 0) {
      setSavePendingDestination("bundle");
      setSaveGapDialog(gapStats);
      return;
    }

    setSaveGapDialog(null);

    const nextZipName = ensureZipFileName(fileName || "motion");
    const bundleBlob = await serializeMotionBundle(axes, generatedSegments, axisInfinity, missingValueStrategy);
    const pickerWindow = window as SaveFilePickerWindow;

    if (pickerWindow.showSaveFilePicker) {
      try {
        const fileHandle = await pickerWindow.showSaveFilePicker({
          suggestedName: nextZipName,
          types: [
            {
              accept: { "application/zip": [".zip"] },
              description: "Motion bundle (CSV + meta)",
            },
          ],
        });
        const writable = await fileHandle.createWritable();

        await writable.write(bundleBlob);
        await writable.close();
        return;
      } catch (saveError) {
        if (saveError instanceof DOMException && saveError.name === "AbortError") {
          return;
        }
      }
    }

    const bundleUrl = URL.createObjectURL(bundleBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = bundleUrl;
    downloadLink.download = nextZipName;
    downloadLink.click();
    URL.revokeObjectURL(bundleUrl);
  };

  const getAxisContextMenuPosition = (clientX: number, clientY: number) => ({
    x: Math.max(6, Math.min(clientX, window.innerWidth - 128)),
    y: Math.max(6, Math.min(clientY, window.innerHeight - 88)),
  });

  const handleAxisRowContextMenu = (event: MouseEvent<HTMLButtonElement>, axisIndex: number) => {
    event.preventDefault();
    event.stopPropagation();

    setGenerationMenu(null);
    setSegmentContextMenu(null);
    setNodeRangeContextMenu(null);
    setAxisContextMenu({
      ...getAxisContextMenuPosition(event.clientX, event.clientY),
      axisIndex,
      kind: "axis",
    });
  };

  const handleAxisListContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    setGenerationMenu(null);
    setSegmentContextMenu(null);
    setNodeRangeContextMenu(null);
    setAxisContextMenu({
      ...getAxisContextMenuPosition(event.clientX, event.clientY),
      kind: "paste",
    });
  };

  const copyAxisFromContextMenu = () => {
    if (axisContextMenu?.kind !== "axis") return;

    const axis = axes.find((candidate) => candidate.index === axisContextMenu.axisIndex);
    if (!axis) {
      setAxisContextMenu(null);
      return;
    }

    setCopiedAxis({
      generatedSegments: generatedSegments
        .filter((segment) => segment.axisIndex === axis.index)
        .map(copyGeneratedSegmentForAxis),
      name: axis.name,
      values: [...axis.values],
    });
    setAxisContextMenu(null);
  };

  const openAxisRenameDialog = () => {
    if (axisContextMenu?.kind !== "axis") return;

    const axis = axes.find((candidate) => candidate.index === axisContextMenu.axisIndex);
    if (!axis) {
      setAxisContextMenu(null);
      return;
    }

    setAxisRenameDialog({
      axisIndex: axis.index,
      value: axis.name ?? "",
    });
    setAxisContextMenu(null);
  };

  const applyAxisRename = () => {
    if (!axisRenameDialog) return;

    const nextName = axisRenameDialog.value.trim();

    pushUndoSnapshot();

    setAxes((current) =>
      current.map((axis) =>
        axis.index === axisRenameDialog.axisIndex
          ? {
              ...axis,
              name: nextName.length > 0 ? nextName : undefined,
            }
          : axis,
      ),
    );
    setAxisRenameDialog(null);
  };

  const pasteAxisFromContextMenu = () => {
    if (!copiedAxis) return;

    pushUndoSnapshot();

    const nextIndex = getNextAxisIndex(axes);
    const nextAxis = {
      index: nextIndex,
      name: copiedAxis.name && !isNumericAxisName(copiedAxis.name) ? `${copiedAxis.name} copy` : undefined,
      values: [...copiedAxis.values],
    };
    const nextSegments = copiedAxis.generatedSegments.map((segment) => {
      generatedSegmentIdRef.current += 1;

      return restoreCopiedGeneratedSegmentForAxis(segment, nextIndex, generatedSegmentIdRef.current);
    });

    setAxes((current) => [...current, nextAxis]);
    setGeneratedSegments((current) => [...current, ...nextSegments]);
    setSelectedAxis(nextIndex);
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setError("");
    if (!fileName) {
      setFileName("new_motion.csv");
    }
    setAxisContextMenu(null);
  };

  const selectAxis = (axisIndex: number) => {
    setAxisContextMenu(null);
    setSegmentContextMenu(null);

    if (selectedAxis === axisIndex) {
      setSelectedAxis(null);
      setSelectedNode(null);
      setSelectedNodes([]);
      setNodeSelectionKind(null);
      return;
    }

    setSelectedAxis(axisIndex);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
  };

  const addAxis = () => {
    pushUndoSnapshot();

    const nextIndex = getNextAxisIndex(axes);
    const nextAxis = {
      index: nextIndex,
      values: [0],
    };

    setAxes((current) => [...current, nextAxis]);
    setSelectedAxis(nextIndex);
    setSelectedNode({ axisIndex: nextIndex, frame: 0 });
    setSelectedNodes([{ axisIndex: nextIndex, frame: 0 }]);
    setNodeSelectionKind("single");
    setNodeDegreeInput("0");
    setError("");
    if (!fileName) {
      setFileName("new_motion.csv");
    }
  };

  const deleteSelectedAxis = () => {
    if (selectedAxis === null) return;

    pushUndoSnapshot();

    setAxes((current) => {
      const selectedPosition = current.findIndex((axis) => axis.index === selectedAxis);
      const nextAxes = current.filter((axis) => axis.index !== selectedAxis);
      const nextSelected = nextAxes[selectedPosition]?.index ?? nextAxes[selectedPosition - 1]?.index ?? null;

      setSelectedAxis(nextSelected);
      return nextAxes;
    });
    setGeneratedSegments((current) => current.filter((segment) => segment.axisIndex !== selectedAxis));
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
  };

  const cutSelectedAxisAtPlayhead = () => {
    if (!selectedAxisRecord) return;

    const cutFrame = Math.max(0, displayedCurrentFrame);
    const nextValues = selectedAxisRecord.values.slice(0, cutFrame + 1);
    const removedGeneratedSegments = generatedSegments.some(
      (segment) => segment.axisIndex === selectedAxisRecord.index && segment.endFrame > cutFrame,
    );

    if (nextValues.length === selectedAxisRecord.values.length && !removedGeneratedSegments) return;

    pushUndoSnapshot();

    const remainingSelectedNodes = selectedNodes.filter(
      (node) => node.axisIndex === selectedAxisRecord.index && node.frame <= cutFrame,
    );
    const fallbackSelectedNode =
      remainingSelectedNodes[0] ??
      nextValues
        .map((value, frame) => (isMotionNumber(value) ? { axisIndex: selectedAxisRecord.index, frame } : null))
        .filter((node): node is SelectedNode => node !== null)
        .at(-1) ??
      null;

    setAxes((current) =>
      current.map((axis) =>
        axis.index === selectedAxisRecord.index
          ? {
              ...axis,
              values: nextValues,
            }
          : axis,
      ),
    );
    setGeneratedSegments((current) =>
      current.filter(
        (segment) => segment.axisIndex !== selectedAxisRecord.index || segment.endFrame <= cutFrame,
      ),
    );
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedNode(fallbackSelectedNode);
    setSelectedNodes(remainingSelectedNodes.length > 0 ? remainingSelectedNodes : fallbackSelectedNode ? [fallbackSelectedNode] : []);
    setNodeSelectionKind(
      remainingSelectedNodes.length > 1 ? nodeSelectionKind : fallbackSelectedNode ? "single" : null,
    );
    setCurrentFrame(cutFrame);
    if (fallbackSelectedNode) {
      syncNodeDegreeInput(nextValues[fallbackSelectedNode.frame]);
    }
  };

  const addNodeToSelectedAxis = () => {
    if (selectedGeneratedSegment || !selectedAxisRecord || activeSelectedNodes.length > 1 || !isNodeDegreeInputValid) return;

    pushUndoSnapshot();

    const selectedNodeOnAxis = activeSelectedNodes[0] ?? null;
    const targetFrame = selectedNodeOnAxis ? selectedNodeOnAxis.frame + 1 : displayedCurrentFrame;
    const targetValue = nodeDegreeValue;
    const nextNode = { axisIndex: selectedAxisRecord.index, frame: targetFrame };

    setAxes((current) =>
      current.map((axis) => {
        if (axis.index !== selectedAxisRecord.index) return axis;

        const nextValues = [...axis.values];
        while (nextValues.length <= targetFrame) {
          nextValues.push(null);
        }
        nextValues[targetFrame] = targetValue;

        return { ...axis, values: nextValues };
      }),
    );
    setSelectedNode(nextNode);
    setSelectedNodes([nextNode]);
    setNodeSelectionKind("single");
    setCurrentFrame(targetFrame);
    setNodeDegreeInput(formatStatNumber(targetValue));
  };

  // Maya Insert Key (S키/더블클릭): 커브 보간 값 그대로 키를 삽입해 곡선 모양을 유지한다.
  // 이미 키가 있는 프레임과 생성 세그먼트 내부는 no-op (유령 undo 방지).
  const insertKeyAtFrame = (frame: number) => {
    if (!selectedAxisRecord) return;

    const targetFrame = clamp(Math.round(frame), 0, MAX_TIMELINE_FRAME);
    const isInsideGeneratedSegment = generatedSegments.some(
      (segment) =>
        segment.axisIndex === selectedAxisRecord.index &&
        targetFrame >= segment.startFrame &&
        targetFrame <= segment.endFrame,
    );

    if (isInsideGeneratedSegment || isMotionNumber(selectedAxisRecord.values[targetFrame])) return;

    const sampledValue = sampleAxisValueAtFrame(selectedAxisRecord.values, targetFrame);
    if (sampledValue === null) return;

    pushUndoSnapshot();

    const nextNode = { axisIndex: selectedAxisRecord.index, frame: targetFrame };

    setAxes((current) =>
      current.map((axis) => {
        if (axis.index !== selectedAxisRecord.index) return axis;

        const nextValues = [...axis.values];
        while (nextValues.length <= targetFrame) {
          nextValues.push(null);
        }
        nextValues[targetFrame] = sampledValue;

        return { ...axis, values: nextValues };
      }),
    );
    setSelectedNode(nextNode);
    setSelectedNodes([nextNode]);
    setNodeSelectionKind("single");
    setCurrentFrame(targetFrame);
    setNodeDegreeInput(formatStatNumber(sampledValue));
  };

  const insertKeyAtPlayhead = () => {
    insertKeyAtFrame(displayedCurrentFrame);
  };

  const handleNodeDegreeInputChange = (value: string) => {
    setNodeDegreeInput(value);
  };

  // Value 입력 정책: "+=N"/"-=N"은 선택된 모든 키에 상대 오프셋 적용,
  // 그 외 절대값은 선택된 모든 키에 동일한 값을 적용한다 (다중 선택 시에도).
  const commitNodeDegreeInput = () => {
    const targets = activeSelectedNodes.filter((node) => node.axisIndex === selectedAxisRecord?.index);

    if (!selectedAxisRecord || targets.length === 0) return;

    const raw = nodeDegreeInput.trim();
    const offsetMatch = raw.match(/^([+-])=\s*(\d+(?:\.\d+)?)$/);
    const amount = offsetMatch ? Number(offsetMatch[2]) * (offsetMatch[1] === "-" ? -1 : 1) : Number(raw);

    if (!Number.isFinite(amount)) {
      syncNodeDegreeInput(primaryNodeValue ?? undefined);
      return;
    }

    // 값이 실제로 바뀌는 대상이 없으면(예: 편집 없이 blur만 발생) undo 스냅샷을 남기지 않는다.
    const updates = targets
      .map((node) => {
        const currentValue = selectedAxisRecord.values[node.frame];
        if (!isMotionNumber(currentValue)) return null;

        const nextValue = offsetMatch ? currentValue + amount : amount;
        return nextValue === currentValue ? null : { node, nextValue };
      })
      .filter((entry): entry is { node: SelectedNode; nextValue: number } => entry !== null);

    if (updates.length === 0) return;

    pushUndoSnapshot();
    updates.forEach(({ node, nextValue }) => updateNodeValue(node.axisIndex, node.frame, nextValue));
  };

  // Frame 편집 정책: 이미 키가 있는 프레임으로 이동하면 해당 프레임 값을 덮어쓴다 (overwrite).
  const commitNodeFrameInput = (rawValue: string) => {
    if (!selectedAxisRecord || !primaryNode || selectedGeneratedSegment) return;

    const parsed = Number(rawValue.trim());
    const fromFrame = primaryNode.frame;
    const value = selectedAxisRecord.values[fromFrame];

    if (!Number.isFinite(parsed) || !isMotionNumber(value)) return;

    const toFrame = clamp(Math.round(parsed), 0, MAX_TIMELINE_FRAME);
    if (toFrame === fromFrame) return;

    pushUndoSnapshot();

    setAxes((current) =>
      current.map((axis) => {
        if (axis.index !== selectedAxisRecord.index) return axis;

        const nextValues = [...axis.values];
        while (nextValues.length <= toFrame) {
          nextValues.push(null);
        }
        nextValues[toFrame] = value;
        nextValues[fromFrame] = null;

        return { ...axis, values: nextValues };
      }),
    );

    const nextNode = { axisIndex: selectedAxisRecord.index, frame: toFrame };
    setSelectedNode(nextNode);
    setSelectedNodes([nextNode]);
    setNodeSelectionKind("single");
    setCurrentFrame(toFrame);
  };

  // 프레임 이동 정책: 대상 프레임에 이미 값이 있으면 덮어쓴다 (commitNodeFrameInput과 동일한 overwrite 정책).
  const applyNodeFrameMove = (
    axisIndex: number,
    baseValues: MotionValue[],
    moves: Array<{ toFrame: number; value: number }>,
  ) => {
    const nextValues = [...baseValues];
    moves.forEach(({ toFrame, value }) => {
      while (nextValues.length <= toFrame) {
        nextValues.push(null);
      }
      nextValues[toFrame] = value;
    });

    setAxes((current) => current.map((axis) => (axis.index === axisIndex ? { ...axis, values: nextValues } : axis)));
  };

  const nudgeSelectedNodes = (deltaFrames: number) => {
    if (!selectedAxisRecord || selectedGeneratedSegment || deltaFrames === 0) return;

    const nodes = activeSelectedNodes.filter((node) => node.axisIndex === selectedAxisRecord.index);
    const origins = nodes
      .map((node) => {
        const value = selectedAxisRecord.values[node.frame];
        return isMotionNumber(value) ? { frame: node.frame, value } : null;
      })
      .filter((entry): entry is { frame: number; value: number } => entry !== null);

    if (origins.length === 0) return;

    const baseValues = [...selectedAxisRecord.values];
    origins.forEach(({ frame }) => {
      baseValues[frame] = null;
    });

    const moves = origins.map(({ frame, value }) => ({
      toFrame: clamp(frame + deltaFrames, 0, MAX_TIMELINE_FRAME),
      value,
    }));

    pushUndoSnapshot();
    applyNodeFrameMove(selectedAxisRecord.index, baseValues, moves);

    const nextSelected = moves.map((move) => ({ axisIndex: selectedAxisRecord.index, frame: move.toFrame }));
    setSelectedNodes(nextSelected);
    setSelectedNode(nextSelected[0] ?? null);
    setNodeSelectionKind(nextSelected.length > 1 ? "range" : nextSelected.length === 1 ? "single" : null);
    setCurrentFrame(nextSelected[0]?.frame ?? currentFrame);
  };

  const nudgeSelectedNodesRef = useRef(nudgeSelectedNodes);
  nudgeSelectedNodesRef.current = nudgeSelectedNodes;

  useEffect(() => {
    const handleNudgeKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      nudgeSelectedNodesRef.current(event.key === "ArrowLeft" ? -step : step);
    };

    window.addEventListener("keydown", handleNudgeKeyDown);
    return () => window.removeEventListener("keydown", handleNudgeKeyDown);
  }, []);

  // 키 2D 드래그 (Maya Move Tool 파리티): 시간+값 동시 이동, Shift = 지배축 잠금,
  // 다중 선택은 모든 키가 같은 오프셋으로 이동해 상대 간격을 유지한다.
  const handleKeyNodePointerDown = (event: PointerEvent<HTMLButtonElement>, node: SelectedNode) => {
    if (event.button !== 0) return;
    if (kKeyRef.current) return;
    event.stopPropagation();

    if (!selectedAxisRecord || selectedGeneratedSegment || node.axisIndex !== selectedAxisRecord.index) return;

    const rect = plotSurfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const isPartOfSelection = selectedNodeKeys.has(nodeKey(node));
    const dragNodes = isPartOfSelection && activeSelectedNodes.length > 1 ? activeSelectedNodes : [node];
    const origins = dragNodes
      .map((dragNode) => {
        const value = selectedAxisRecord.values[dragNode.frame];
        return isMotionNumber(value) ? { frame: dragNode.frame, value } : null;
      })
      .filter((entry): entry is { frame: number; value: number } => entry !== null);

    if (origins.length === 0) return;

    event.preventDefault();

    const baseValues = [...selectedAxisRecord.values];
    origins.forEach(({ frame }) => {
      baseValues[frame] = null;
    });

    nodeFrameDragRef.current = {
      axisIndex: selectedAxisRecord.index,
      startClientX: event.clientX,
      startClientY: event.clientY,
      framesPerPixel: visibleFrameSpan / rect.width,
      valuePerPixel:
        (Math.max(yRange.max - yRange.min, 0.0001) * 100) / (PLOT_VALUE_SPAN_PERCENT * rect.height),
      baseValues,
      origins,
      moved: false,
    };

    // 드래그로 키의 프레임이 바뀌면 해당 키 버튼이 리마운트되어 pointer capture가 끊긴다.
    // 드래그 수명을 DOM 노드와 분리하기 위해 window 리스너로 추적한다.
    const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const drag = nodeFrameDragRef.current;
      if (!drag || moveEvent.pointerId !== event.pointerId) return;

      const deltaX = moveEvent.clientX - drag.startClientX;
      const deltaY = moveEvent.clientY - drag.startClientY;

      // 데드존: 클릭 수준의 미세 이동은 드래그로 취급하지 않는다 (클릭 선택·유령 undo 방지).
      if (!drag.moved && Math.abs(deltaX) < NODE_DRAG_DEAD_ZONE_PX && Math.abs(deltaY) < NODE_DRAG_DEAD_ZONE_PX) return;

      const axisLock = moveEvent.shiftKey ? (Math.abs(deltaX) >= Math.abs(deltaY) ? "time" : "value") : null;
      const deltaFrames = axisLock === "value" ? 0 : Math.round(deltaX * drag.framesPerPixel);
      const deltaValue = axisLock === "time" ? 0 : -deltaY * drag.valuePerPixel;

      if (!drag.moved) {
        pushUndoSnapshot();
        drag.moved = true;
      }

      const moves = drag.origins.map(({ frame, value }) => ({
        toFrame: clamp(frame + deltaFrames, 0, MAX_TIMELINE_FRAME),
        value: applyValueSnap(value + deltaValue),
      }));

      applyNodeFrameMove(drag.axisIndex, drag.baseValues, moves);

      const nextSelected = moves.map((move) => ({ axisIndex: drag.axisIndex, frame: move.toFrame }));
      setSelectedNodes(nextSelected);
      setSelectedNode(nextSelected[0] ?? null);
      if (nextSelected[0]) {
        setCurrentFrame(nextSelected[0].frame);
      }
      if (moves.length === 1) {
        setNodeDegreeInput(formatStatNumber(moves[0].value));
      }
    };

    const handleWindowPointerEnd = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) return;

      const drag = nodeFrameDragRef.current;
      nodeFrameDragRef.current = null;
      justDraggedNodeFrameRef.current = drag?.moved ?? false;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
  };

  // Maya Region(Scale Keys): 박스 에지를 드래그하면 반대쪽 에지를 피벗으로 선택 키를 스케일.
  // 프레임 반올림으로 두 키가 겹치면 뒤 키가 남는다 (기존 이동과 동일한 overwrite 정책).
  const handleRegionScalePointerDown = (event: PointerEvent<HTMLButtonElement>, edge: RegionScaleEdge) => {
    if (event.button !== 0 || kKeyRef.current) return;
    if (!selectedAxisRecord || !regionScaleBounds) return;

    const rect = plotSurfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const origins = selectedNodes
      .filter((node) => node.axisIndex === selectedAxisRecord.index)
      .map((node) => {
        const value = selectedAxisRecord.values[node.frame];
        return isMotionNumber(value) ? { frame: node.frame, value } : null;
      })
      .filter((entry): entry is { frame: number; value: number } => entry !== null);

    if (origins.length < 2) return;

    event.preventDefault();
    event.stopPropagation();

    const baseValues = [...selectedAxisRecord.values];
    origins.forEach(({ frame }) => {
      baseValues[frame] = null;
    });

    regionScaleDragRef.current = {
      axisIndex: selectedAxisRecord.index,
      edge,
      startClientX: event.clientX,
      startClientY: event.clientY,
      framesPerPixel: visibleFrameSpan / rect.width,
      valuePerPixel:
        (Math.max(yRange.max - yRange.min, 0.0001) * 100) / (PLOT_VALUE_SPAN_PERCENT * rect.height),
      baseValues,
      origins,
      ...regionScaleBounds,
      moved: false,
    };

    const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const drag = regionScaleDragRef.current;
      if (!drag || moveEvent.pointerId !== event.pointerId) return;

      const deltaX = moveEvent.clientX - drag.startClientX;
      const deltaY = moveEvent.clientY - drag.startClientY;

      if (!drag.moved && Math.abs(deltaX) < NODE_DRAG_DEAD_ZONE_PX && Math.abs(deltaY) < NODE_DRAG_DEAD_ZONE_PX) return;

      const isTimeScale = drag.edge === "left" || drag.edge === "right";
      const pivotFrame = drag.edge === "right" ? drag.minFrame : drag.maxFrame;
      const pivotValue = drag.edge === "top" ? drag.minValue : drag.maxValue;
      let scale: number;

      if (isTimeScale) {
        const edgeFrame = drag.edge === "right" ? drag.maxFrame : drag.minFrame;
        const span = edgeFrame - pivotFrame;
        if (span === 0) return;
        scale = (edgeFrame + deltaX * drag.framesPerPixel - pivotFrame) / span;
      } else {
        const edgeValue = drag.edge === "top" ? drag.maxValue : drag.minValue;
        const span = edgeValue - pivotValue;
        if (Math.abs(span) < 1e-9) return;
        scale = (edgeValue - deltaY * drag.valuePerPixel - pivotValue) / span;
      }

      if (!drag.moved) {
        pushUndoSnapshot();
        drag.moved = true;
      }

      const moves = drag.origins.map(({ frame, value }) =>
        isTimeScale
          ? {
              toFrame: clamp(Math.round(pivotFrame + (frame - pivotFrame) * scale), 0, MAX_TIMELINE_FRAME),
              value,
            }
          : { toFrame: frame, value: applyValueSnap(pivotValue + (value - pivotValue) * scale) },
      );

      applyNodeFrameMove(drag.axisIndex, drag.baseValues, moves);

      const nextFrames = [...new Set(moves.map((move) => move.toFrame))].sort((left, right) => left - right);
      const nextSelected = nextFrames.map((frame) => ({ axisIndex: drag.axisIndex, frame }));
      setSelectedNodes(nextSelected);
      setSelectedNode(nextSelected[0] ?? null);
    };

    const handleWindowPointerEnd = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) return;

      regionScaleDragRef.current = null;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
  };

  const shiftSelectedNodeToLeft = () => {
    if (!selectedAxisRecord || !selectedShiftNode || !canShiftNode) return;

    const targetFrame = selectedShiftNode.frame;
    const targetValue = selectedAxisRecord.values[targetFrame];
    if (!isMotionNumber(targetValue)) return;

    const previousNode = selectedAxisRecord.values
      .map((value, frame) =>
        frame < targetFrame && isMotionNumber(value)
          ? {
              frame,
            }
          : null,
      )
      .filter((entry): entry is { frame: number } => entry !== null)
      .at(-1);
    const nextTargetFrame = previousNode ? previousNode.frame + 1 : 0;
    const shiftAmount = targetFrame - nextTargetFrame;

    if (shiftAmount <= 0) return;

    pushUndoSnapshot();

    const nextValues = selectedAxisRecord.values.slice(0, nextTargetFrame);

    for (let frame = targetFrame; frame < selectedAxisRecord.values.length; frame += 1) {
      nextValues[frame - shiftAmount] = selectedAxisRecord.values[frame];
    }

    const nextSelectedNode = { axisIndex: selectedAxisRecord.index, frame: nextTargetFrame };

    setAxes((current) =>
      current.map((axis) =>
        axis.index === selectedAxisRecord.index
          ? {
              ...axis,
              values: nextValues,
            }
          : axis,
      ),
    );
    setGeneratedSegments((current) =>
      current.map((segment) =>
        segment.axisIndex === selectedAxisRecord.index
          ? shiftGeneratedSegmentFrames(segment, targetFrame, shiftAmount)
          : segment,
      ),
    );
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedNode(nextSelectedNode);
    setSelectedNodes([nextSelectedNode]);
    setNodeSelectionKind("single");
    setCurrentFrame(nextTargetFrame);
    setNodeDegreeInput(formatStatNumber(targetValue));
  };

  const deleteSelectedNodes = () => {
    if (hasRemovableNodeSelection && selectedAxisRecord) {
      const targetNodes = activeSelectedNodes;
      if (targetNodes.length === 0) return;

      pushUndoSnapshot();

      const targetFrames = new Set(targetNodes.map((node) => node.frame));
      const firstDeletedFrame = Math.min(...targetNodes.map((node) => node.frame));
      const previousNode = selectedAxisRecord.values
        .map((value, frame) =>
          isMotionNumber(value) && frame < firstDeletedFrame && !targetFrames.has(frame) ? { frame } : null,
        )
        .filter((entry): entry is { frame: number } => entry !== null)
        .at(-1);
      const nextSelectedNode = previousNode ? { axisIndex: selectedAxisRecord.index, frame: previousNode.frame } : null;

      setAxes((current) =>
        current.map((axis) =>
          axis.index === selectedAxisRecord.index
            ? {
                ...axis,
                values: axis.values.map((value, frame) => (targetFrames.has(frame) ? null : value)),
              }
            : axis,
        ),
      );
      setGeneratedSegments((current) =>
        current.filter(
          (segment) =>
            segment.axisIndex !== selectedAxisRecord.index ||
            !targetNodes.some((node) => node.frame >= segment.startFrame && node.frame <= segment.endFrame),
        ),
      );
      setSelectedGeneratedSegmentKey(null);
      setSelectedGeneratedHandle(null);
      setSelectedNode(nextSelectedNode);
      setSelectedNodes(nextSelectedNode ? [nextSelectedNode] : []);
      setNodeSelectionKind(nextSelectedNode ? "single" : null);
      if (nextSelectedNode) {
        setCurrentFrame(nextSelectedNode.frame);
        syncNodeDegreeInput(selectedAxisRecord.values[nextSelectedNode.frame]);
      }
      return;
    }

    if (selectedGeneratedSegment) {
      const segmentAxis = axes.find((axis) => axis.index === selectedGeneratedSegment.axisIndex);
      if (!segmentAxis) return;

      pushUndoSnapshot();

      const startFrame = Math.min(selectedGeneratedSegment.startFrame, selectedGeneratedSegment.endFrame);
      const endFrame = Math.max(selectedGeneratedSegment.startFrame, selectedGeneratedSegment.endFrame);
      const previousNode = segmentAxis.values
        .map((value, frame) => (isMotionNumber(value) && frame < startFrame ? { frame } : null))
        .filter((entry): entry is { frame: number } => entry !== null)
        .at(-1);
      const nextSelectedNode = previousNode ? { axisIndex: segmentAxis.index, frame: previousNode.frame } : null;

      setAxes((current) =>
        current.map((axis) =>
          axis.index === segmentAxis.index
            ? {
                ...axis,
                values: axis.values.map((value, frame) => (frame >= startFrame && frame <= endFrame ? null : value)),
              }
            : axis,
        ),
      );
      setGeneratedSegments((current) =>
        current.filter((segment) => segment.id !== selectedGeneratedSegment.id),
      );
      setSelectedGeneratedSegmentKey(null);
      setSelectedGeneratedHandle(null);
      setSelectedAxis(segmentAxis.index);
      setSelectedNode(nextSelectedNode);
      setSelectedNodes(nextSelectedNode ? [nextSelectedNode] : []);
      setNodeSelectionKind(nextSelectedNode ? "single" : null);
      setCurrentFrame(nextSelectedNode ? nextSelectedNode.frame : startFrame);
      if (nextSelectedNode) {
        syncNodeDegreeInput(segmentAxis.values[nextSelectedNode.frame]);
      }
      return;
    }
  };

  const applyVisibleRange = (nextRange: VisibleRange) => {
    setVisibleRange(nextRange);
  };

  const fitGraph = () => {
    applyVisibleRange(frameCount > 1 ? { start: 0, end: maxFrameIndex } : { start: 0, end: DEFAULT_TIMELINE_MAX_FRAME });
    setYRange(buildDataYRange(axes));
  };

  const computeFrameSelectionBounds = () => {
    if (activeSelectedNodes.length > 0 && selectedAxisRecord) {
      const frames = activeSelectedNodes.map((node) => node.frame);
      const values = activeSelectedNodes
        .map((node) => selectedAxisRecord.values[node.frame])
        .filter(isMotionNumber);

      if (values.length === 0) return null;

      return {
        minFrame: Math.min(...frames),
        maxFrame: Math.max(...frames),
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
      };
    }

    if (selectedGeneratedSegment) {
      const segmentAxis = axes.find((axis) => axis.index === selectedGeneratedSegment.axisIndex);
      if (!segmentAxis) return null;

      const frameBounds = buildGeneratedSegmentFrameBounds(selectedGeneratedSegment);
      const scanStart = Math.max(0, Math.floor(frameBounds.minFrame));
      const scanEnd = Math.min(segmentAxis.values.length - 1, Math.ceil(frameBounds.maxFrame));
      const values: number[] = [];

      for (let frame = scanStart; frame <= scanEnd; frame += 1) {
        const value = segmentAxis.values[frame];
        if (isMotionNumber(value)) values.push(value);
      }

      if (values.length === 0) return null;

      return {
        minFrame: frameBounds.minFrame,
        maxFrame: frameBounds.maxFrame,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
      };
    }

    return null;
  };

  const hasFrameSelectionTarget = activeSelectedNodes.length > 0 || selectedGeneratedSegment !== null;

  const focusSelectedAxisAtPlayhead = () => {
    const bounds = computeFrameSelectionBounds();
    if (!bounds) return;

    const frameSpan = Math.max(bounds.maxFrame - bounds.minFrame, 1);
    const framePadding = Math.max(frameSpan * 0.2, 4);
    const valueSpan = Math.max(bounds.maxValue - bounds.minValue, 0.001);
    const valuePadding = Math.max(valueSpan * 0.2, 2);
    const nextRange = clampRange(
      bounds.minFrame - framePadding,
      frameSpan + framePadding * 2,
      Math.max(timelineMaxIndex, bounds.maxFrame + framePadding),
    );

    applyVisibleRange(nextRange);
    setYRange({ min: bounds.minValue - valuePadding, max: bounds.maxValue + valuePadding });
  };

  const globalShortcutHandlersRef = useRef({
    undoLastEdit,
    redoLastEdit,
    fitGraph,
    focusSelectedAxisAtPlayhead,
    insertKeyAtPlayhead,
    deleteSelectedNodes,
  });
  globalShortcutHandlersRef.current = {
    undoLastEdit,
    redoLastEdit,
    fitGraph,
    focusSelectedAxisAtPlayhead,
    insertKeyAtPlayhead,
    deleteSelectedNodes,
  };

  useEffect(() => {
    const handleGlobalShortcutKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const isModifierHeld = event.ctrlKey || event.metaKey;

      if (isModifierHeld && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          globalShortcutHandlersRef.current.redoLastEdit();
        } else {
          globalShortcutHandlersRef.current.undoLastEdit();
        }
        return;
      }

      if (isModifierHeld) return;

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        globalShortcutHandlersRef.current.focusSelectedAxisAtPlayhead();
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        globalShortcutHandlersRef.current.fitGraph();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        globalShortcutHandlersRef.current.insertKeyAtPlayhead();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        globalShortcutHandlersRef.current.deleteSelectedNodes();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcutKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalShortcutKeyDown);
  }, []);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const span = visibleRange.end - visibleRange.start;
    const rangeMaxFrame = Math.max(timelineMaxIndex, Math.ceil(visibleRange.end));
    const minSpan = frameCount > 1 ? Math.min(8, rangeMaxFrame) : 1;

    if (event.deltaY < 0 && span <= minSpan + 0.0001) {
      return;
    }

    const zoomFactor = event.deltaY > 0 ? 1.18 : 0.84;
    const nextSpan = Math.max(span * zoomFactor, minSpan);
    const anchorFrame = visibleRange.start + span * pointerRatio;
    const nextStart = anchorFrame - nextSpan * pointerRatio;

    applyVisibleRange(
      frameCount > 1 ? clampRange(nextStart, nextSpan, rangeMaxFrame) : clampFreeRange(nextStart, nextSpan),
    );
  };

  const handleYWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.shiftKey) {
      handleWheel(event);
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const span = Math.max(yRange.max - yRange.min, 0.0001);
    const zoomFactor = event.deltaY > 0 ? 1.18 : 0.84;
    const nextSpan = Math.max(span * zoomFactor, 0.001);
    const anchorDegree = yRange.max - span * pointerRatio;
    const nextMax = anchorDegree + nextSpan * pointerRatio;
    const nextMin = nextMax - nextSpan;

    setYRange({ min: nextMin, max: nextMax });
  };

  const setPlayheadFromClientX = (clientX: number, container: HTMLElement | null) => {
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const span = visibleRange.end - visibleRange.start;
    const nextFrame = clamp(Math.round(visibleRange.start + span * ratio), 0, MAX_TIMELINE_FRAME);
    const nextSelectedNode =
      selectedAxisRecord && isMotionNumber(selectedAxisRecord.values[nextFrame])
        ? {
            axisIndex: selectedAxisRecord.index,
            frame: nextFrame,
          }
        : null;

    setCurrentFrame(nextFrame);
    setSelectedNode(nextSelectedNode);
    setSelectedNodes(nextSelectedNode ? [nextSelectedNode] : []);
    setNodeSelectionKind(nextSelectedNode ? "single" : null);
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    if (nextSelectedNode) {
      syncNodeDegreeInput(selectedAxisRecord?.values[nextFrame]);
    }
  };

  const handlePlayheadPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(event.pointerId);
    playheadDragRef.current = true;
    setIsDraggingPlayhead(true);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setPlayheadFromClientX(event.clientX, event.currentTarget.parentElement);
  };

  const handlePlayheadPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!playheadDragRef.current) return;

    setPlayheadFromClientX(event.clientX, event.currentTarget.parentElement);
  };

  const handlePlayheadPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    playheadDragRef.current = false;
    setIsDraggingPlayhead(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleRulerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".playbackRangeHandle")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    playheadDragRef.current = true;
    setIsDraggingPlayhead(true);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setPlayheadFromClientX(event.clientX, event.currentTarget);
  };

  const handleRulerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!playheadDragRef.current) return;

    setPlayheadFromClientX(event.clientX, event.currentTarget);
  };

  const handleRulerPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    playheadDragRef.current = false;
    setIsDraggingPlayhead(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const setPlaybackRangeEdgeFromClientX = (clientX: number, container: HTMLElement, edge: "start" | "end") => {
    const rect = container.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const span = visibleRange.end - visibleRange.start;
    const nextFrame = clamp(Math.round(visibleRange.start + span * ratio), 0, MAX_TIMELINE_FRAME);

    setPlaybackRange((current) =>
      edge === "start"
        ? { start: Math.min(nextFrame, current.end), end: current.end }
        : { start: current.start, end: Math.max(nextFrame, current.start) },
    );
  };

  const handlePlaybackRangeHandlePointerDown = (event: PointerEvent<HTMLButtonElement>, edge: "start" | "end") => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(event.pointerId);
    playbackRangeDragRef.current = { edge, moved: false };
  };

  const handlePlaybackRangeHandlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = playbackRangeDragRef.current;
    if (!drag) return;

    if (!drag.moved) {
      pushUndoSnapshot();
      drag.moved = true;
    }

    setPlaybackRangeEdgeFromClientX(event.clientX, event.currentTarget.parentElement as HTMLElement, drag.edge);
  };

  const handlePlaybackRangeHandlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    playbackRangeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const framePlaybackRange = () => {
    setVisibleRange({ ...playbackRange });
  };

  const setAxisInfinityMode = (side: "pre" | "post", mode: InfinityMode) => {
    if (!selectedAxisRecord) return;

    const current = axisInfinity[selectedAxisRecord.index] ?? DEFAULT_AXIS_INFINITY;
    if (current[side] === mode) return;

    pushUndoSnapshot();
    setAxisInfinity((previous) => ({
      ...previous,
      [selectedAxisRecord.index]: { ...current, [side]: mode },
    }));
  };

  const canBakeInfinity =
    selectedAxisRecord !== null &&
    (selectedAxisInfinity.pre !== "constant" || selectedAxisInfinity.post !== "constant");

  // Bake ∞: Playback Range 안에서 데이터 범위 밖 프레임에 infinity 평가값을 실제 키로 기록한다.
  // CSV 저장은 조밀 데이터만 포함하므로 저장 전에 베이크해야 무한 반복이 파일에 반영된다.
  const bakeInfinityToPlaybackRange = () => {
    if (!selectedAxisRecord) return;

    const modes = axisInfinity[selectedAxisRecord.index] ?? DEFAULT_AXIS_INFINITY;
    const values = selectedAxisRecord.values;
    const firstFrame = getFirstMotionValueFrame(values);
    const lastFrame = getLastMotionValueFrame(values);
    if (firstFrame === null || lastFrame === null) return;

    const fromFrame = clamp(Math.round(playbackRange.start), 0, MAX_TIMELINE_FRAME);
    const toFrame = clamp(Math.round(playbackRange.end), 0, MAX_TIMELINE_FRAME);
    const writes: Array<{ frame: number; value: MotionValue }> = [];

    for (let frame = fromFrame; frame <= toFrame; frame += 1) {
      const side = frame < firstFrame ? "pre" : frame > lastFrame ? "post" : null;
      if (!side || modes[side] === "constant") continue;

      const nextValue = evaluateInfinityFrame(values, firstFrame, lastFrame, frame, modes[side]);
      const currentValue = values[frame] ?? null;
      if (nextValue === currentValue) continue;

      writes.push({ frame, value: nextValue });
    }

    if (writes.length === 0) return;

    pushUndoSnapshot();

    setAxes((current) =>
      current.map((axis) => {
        if (axis.index !== selectedAxisRecord.index) return axis;

        const maxWriteFrame = writes[writes.length - 1].frame;
        const nextValues = [...axis.values];
        while (nextValues.length <= maxWriteFrame) {
          nextValues.push(null);
        }
        writes.forEach(({ frame, value }) => {
          nextValues[frame] = value;
        });

        return { ...axis, values: nextValues };
      }),
    );
  };

  // Maya Buffer Curve: 현재 커브를 버퍼로 저장해 회색 고스트로 비교하고, Swap으로 되돌린다.
  const snapshotBufferCurve = () => {
    if (!selectedAxisRecord) return;

    pushUndoSnapshot();
    setBufferCurves((previous) => ({
      ...previous,
      [selectedAxisRecord.index]: [...selectedAxisRecord.values],
    }));
    setShowBufferCurves(true);
  };

  const toggleShowBufferCurves = () => {
    setShowBufferCurves((previous) => !previous);
  };

  const swapBufferCurve = () => {
    if (!selectedAxisRecord) return;

    const buffered = bufferCurves[selectedAxisRecord.index];
    if (!buffered) return;

    pushUndoSnapshot();

    const currentValues = [...selectedAxisRecord.values];

    setAxes((current) =>
      current.map((axis) =>
        axis.index === selectedAxisRecord.index ? { ...axis, values: [...buffered] } : axis,
      ),
    );
    setBufferCurves((previous) => ({
      ...previous,
      [selectedAxisRecord.index]: currentValues,
    }));
    // 스왑 후 선택 노드/세그먼트가 사라진 프레임을 가리킬 수 있어 선택을 정리한다.
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
  };

  const hasSelectedAxisBuffer = selectedAxisRecord !== null && bufferCurves[selectedAxisRecord.index] !== undefined;

  // Maya Outliner 파리티: eye 토글로 축을 플롯에서 숨기고, Isolate로 선택 축만 표시한다.
  // 표시/숨김은 뷰 상태이므로 undo 스택에 포함하지 않는다.
  const isAxisVisibleInPlot = (axisIndex: number) =>
    isolateSelectedAxis && selectedAxis !== null ? axisIndex === selectedAxis : !hiddenAxes.has(axisIndex);

  const isSelectedAxisPlotVisible = selectedAxis !== null && isAxisVisibleInPlot(selectedAxis);

  const toggleAxisVisibility = (axisIndex: number) => {
    setHiddenAxes((previous) => {
      const next = new Set(previous);
      if (next.has(axisIndex)) {
        next.delete(axisIndex);
      } else {
        next.add(axisIndex);
      }
      return next;
    });
  };

  const toggleIsolateSelectedAxis = () => {
    setIsolateSelectedAxis((previous) => !previous);
  };

  // Maya Snap 파리티: 드래그 값 편집을 정수 grid에 스냅. ref는 드래그 window 리스너
  // 클로저(다운 시점 고정)에서도 최신 토글 상태를 읽기 위한 것.
  const toggleSnapValues = () => {
    setSnapValues((previous) => {
      snapValuesRef.current = !previous;
      return !previous;
    });
  };

  const applyValueSnap = (value: number) => (snapValuesRef.current ? Math.round(value) : value);

  const getPlotPointerPercent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const handlePlotContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setAxisContextMenu(null);

    if (copiedNodeRangeCandidateTarget) {
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu({
        ...getSegmentContextMenuPosition(event.clientX, event.clientY),
        kind: "paste",
      });
      return;
    }

    if (selectedAxisRecord && nodeSelectionKind === "range" && activeSelectedNodes.length > 1) {
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu({
        ...getSegmentContextMenuPosition(event.clientX, event.clientY),
        kind: "copy",
      });
      return;
    }

    if (copiedGeneratedSegmentPasteTarget) {
      setGenerationMenu(null);
      setNodeRangeContextMenu(null);
      setSegmentContextMenu({
        ...getSegmentContextMenuPosition(event.clientX, event.clientY),
        kind: "paste",
      });
      return;
    }

    if (selectedGeneratedSegment) {
      setGenerationMenu(null);
      setNodeRangeContextMenu(null);
      setSegmentContextMenu({
        ...getSegmentContextMenuPosition(event.clientX, event.clientY),
        kind: "copy",
        segmentId: selectedGeneratedSegment.id,
      });
      return;
    }

    if (!selectedAxisRecord || nodeSelectionKind !== "ctrl" || activeSelectedNodes.length < 2) {
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu(null);
      return;
    }

    setSegmentContextMenu(null);
    setNodeRangeContextMenu(null);
    setGenerationMenu({
      x: Math.max(6, Math.min(event.clientX, window.innerWidth - 180)),
      y: Math.max(6, Math.min(event.clientY, window.innerHeight - 310)),
    });
  };

  const generateFromContextMenu = (mode: GeneratedSegmentMode) => {
    if (!canGenerateMode(mode)) return;

    generateMotionData(mode);
    setGenerationMenu(null);
  };

  const copyNodeRangeFromContextMenu = () => {
    if (nodeRangeContextMenu?.kind !== "copy" || !selectedAxisRecord || nodeSelectionKind !== "range") return;

    const orderedNodes = [...activeSelectedNodes].sort((left, right) => left.frame - right.frame);
    const startNode = orderedNodes[0];
    const endNode = orderedNodes.at(-1);
    const startValue = startNode ? selectedAxisRecord.values[startNode.frame] : null;

    if (!startNode || !endNode || !isMotionNumber(startValue) || orderedNodes.length < 2) {
      setNodeRangeContextMenu(null);
      return;
    }

    const copiedNodes = orderedNodes
      .map((node) => {
        const value = selectedAxisRecord.values[node.frame];

        return isMotionNumber(value)
          ? {
              offset: node.frame - startNode.frame,
              valueOffset: value - startValue,
            }
          : null;
      })
      .filter((node): node is { offset: number; valueOffset: number } => node !== null);

    if (copiedNodes.length < 2) {
      setNodeRangeContextMenu(null);
      return;
    }

    setCopiedNodeRange({
      duration: endNode.frame - startNode.frame,
      nodes: copiedNodes,
    });
    setCopiedGeneratedSegment(null);
    setError("");
    setNodeRangeContextMenu(null);
  };

  const cutNodeRangeFromContextMenu = () => {
    copyNodeRangeFromContextMenu();
    deleteSelectedNodes();
  };

  const pasteNodeRangeFromContextMenu = () => {
    if (!copiedNodeRange || !copiedNodeRangePasteTarget) return;

    const { axis, endFrame, startFrame, startValue } = copiedNodeRangePasteTarget;
    const insertSpan = endFrame - startFrame + 1;
    let nextValues = [...axis.values];

    if (nodeRangePasteMode === "insert") {
      // Insert: startFrame 이후 키를 통째로 뒤로 밀어 붙여넣을 공간을 만든다.
      nextValues = [
        ...nextValues.slice(0, startFrame),
        ...(new Array(insertSpan).fill(null) as MotionValue[]),
        ...nextValues.slice(startFrame),
      ];
    } else {
      while (nextValues.length <= endFrame) {
        nextValues.push(null);
      }

      if (nodeRangePasteMode === "replace") {
        // Replace: 붙여넣기 구간 전체를 먼저 비운 뒤 복사한 키만 남긴다.
        for (let frame = startFrame; frame <= endFrame; frame += 1) {
          nextValues[frame] = null;
        }
      }
      // Merge(기본값): 구간을 비우지 않고 복사한 오프셋만 덮어쓴다.
    }

    copiedNodeRange.nodes.forEach(({ offset, valueOffset }) => {
      nextValues[startFrame + offset] = startValue + valueOffset;
    });

    const pastedNodes = copiedNodeRange.nodes.map(({ offset }) => ({
      axisIndex: axis.index,
      frame: startFrame + offset,
    }));

    pushUndoSnapshot();

    setAxes((current) =>
      current.map((currentAxis) =>
        currentAxis.index === axis.index
          ? {
              ...currentAxis,
              values: nextValues,
            }
          : currentAxis,
      ),
    );
    setGeneratedSegments((current) =>
      nodeRangePasteMode === "insert"
        ? current.map((segment) =>
            segment.axisIndex === axis.index
              ? shiftGeneratedSegmentFrames(segment, startFrame, -insertSpan)
              : segment,
          )
        : current.filter(
            (segment) =>
              segment.axisIndex !== axis.index ||
              segment.endFrame < startFrame ||
              segment.startFrame > endFrame,
          ),
    );
    setSelectedAxis(axis.index);
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    setSelectedNode(pastedNodes[0] ?? null);
    setSelectedNodes(pastedNodes);
    setNodeSelectionKind(pastedNodes.length > 1 ? "range" : pastedNodes.length === 1 ? "single" : null);
    setCurrentFrame(startFrame);
    setNodeDegreeInput(formatStatNumber(startValue));
    setCopiedNodeRange(null);
    setError("");
    setNodeRangeContextMenu(null);
  };

  const handleGeneratedSegmentContextMenu = (event: MouseEvent<HTMLElement>, segment: GeneratedSegment) => {
    event.preventDefault();
    event.stopPropagation();

    setGenerationMenu(null);
    setAxisContextMenu(null);
    setSelectedGeneratedSegmentKey(generatedSegmentKey(segment));
    setSelectedAxis(segment.axisIndex);
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setSelectedGeneratedHandle(null);
    setSegmentContextMenu({
      ...getSegmentContextMenuPosition(event.clientX, event.clientY),
      kind: "copy",
      segmentId: segment.id,
    });
  };

  const copyGeneratedSegmentFromContextMenu = () => {
    if (segmentContextMenu?.kind !== "copy") return;

    const segment = generatedSegments.find((candidate) => candidate.id === segmentContextMenu.segmentId);
    const axis = segment ? axes.find((candidate) => candidate.index === segment.axisIndex) : null;
    const copiedSegment = segment && axis ? copyGeneratedSegmentForPaste(segment, axis.values) : null;

    if (copiedSegment) {
      setCopiedGeneratedSegment(copiedSegment);
      setCopiedNodeRange(null);
      setError("");
    }

    setSegmentContextMenu(null);
  };

  const pasteGeneratedSegmentFromContextMenu = () => {
    if (!copiedGeneratedSegment || !copiedGeneratedSegmentPasteTarget) return;

    const { axis, endFrame, startFrame, startValue } = copiedGeneratedSegmentPasteTarget;
    const nextValues = [...axis.values];

    while (nextValues.length <= endFrame) {
      nextValues.push(null);
    }

    Object.entries(copiedGeneratedSegment.valueOffsets).forEach(([offset, valueOffset]) => {
      const frame = startFrame + Number(offset);

      if (Number.isFinite(frame) && frame >= startFrame && frame <= endFrame) {
        nextValues[frame] = startValue + valueOffset;
      }
    });

    pushUndoSnapshot();

    generatedSegmentIdRef.current += 1;

    const nextSegment: GeneratedSegment = {
      axisIndex: axis.index,
      baselineValues: buildGeneratedSegmentBaselineValues(nextValues, startFrame, endFrame),
      endFrame,
      handles: restoreGeneratedHandleOffsets(copiedGeneratedSegment.handles, startFrame),
      id: generatedSegmentIdRef.current,
      initialHandles: copiedGeneratedSegment.initialHandles
        ? restoreGeneratedHandleOffsets(copiedGeneratedSegment.initialHandles, startFrame)
        : undefined,
      keyFrames: copiedGeneratedSegment.keyFrameOffsets.map((offset) => startFrame + offset),
      mode: copiedGeneratedSegment.mode,
      startFrame,
    };
    const nextSelectedNode = { axisIndex: axis.index, frame: startFrame };

    setAxes((current) =>
      current.map((currentAxis) =>
        currentAxis.index === axis.index
          ? {
              ...currentAxis,
              values: nextValues,
            }
          : currentAxis,
      ),
    );
    setGeneratedSegments((current) => [...current, nextSegment]);
    setSelectedAxis(axis.index);
    setSelectedGeneratedSegmentKey(generatedSegmentKey(nextSegment));
    setSelectedGeneratedHandle(null);
    setSelectedNode(nextSelectedNode);
    setSelectedNodes([nextSelectedNode]);
    setNodeSelectionKind("single");
    setCurrentFrame(startFrame);
    setNodeDegreeInput(formatStatNumber(startValue));
    setCopiedGeneratedSegment(null);
    setError("");
    setSegmentContextMenu(null);
  };

  const applyGeneratedSegmentToAxes = (segment: GeneratedSegment) => {
    setAxes((current) =>
      current.map((axis) =>
        axis.index === segment.axisIndex
          ? {
              ...axis,
              values: applyGeneratedSegmentToValues(axis.values, segment),
            }
          : axis,
      ),
    );
  };

  const updateGeneratedHandle = (
    segmentId: number,
    frame: number,
    update: (handle: GeneratedHandlePosition) => GeneratedHandlePosition,
  ) => {
    const segment = generatedSegments.find((candidate) => candidate.id === segmentId);
    const axis = segment ? axes.find((candidate) => candidate.index === segment.axisIndex) : null;
    const keyFrames = segment?.keyFrames ?? [];
    const currentHandle =
      segment?.handles[frame.toString()] ??
      (axis ? buildDefaultGeneratedHandlePosition(axis.values, keyFrames, frame) : null);

    if (!segment || !axis || !currentHandle) return;

    const nextHandle = update(currentHandle);
    const nextSegment = {
      ...segment,
      handles: {
        ...segment.handles,
        [frame.toString()]: nextHandle,
      },
    };

    setGeneratedSegments((current) =>
      current.map((candidate) => (candidate.id === segmentId ? nextSegment : candidate)),
    );
    applyGeneratedSegmentToAxes(nextSegment);
  };

  const updateSelectedGeneratedHandleField = (field: GeneratedHandleField, value: string) => {
    if (!selectedGeneratedHandle) return;

    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;

    pushUndoSnapshot();

    updateGeneratedHandle(selectedGeneratedHandle.segmentId, selectedGeneratedHandle.frame, (handle) => {
      if (field === "angle" || field === "rightAngle") {
        return { ...handle, [field]: nextValue };
      }

      const clampedLength = Math.max(0.1, nextValue);
      return handle.weightLocked
        ? { ...handle, leftLength: clampedLength, rightLength: clampedLength }
        : { ...handle, [field]: clampedLength };
    });
  };

  const breakSelectedGeneratedHandle = () => {
    if (!selectedGeneratedHandle) return;

    pushUndoSnapshot();
    updateGeneratedHandle(selectedGeneratedHandle.segmentId, selectedGeneratedHandle.frame, (handle) => ({
      ...handle,
      rightAngle: handle.rightAngle ?? handle.angle,
    }));
  };

  const unifySelectedGeneratedHandle = () => {
    if (!selectedGeneratedHandle) return;

    pushUndoSnapshot();
    updateGeneratedHandle(selectedGeneratedHandle.segmentId, selectedGeneratedHandle.frame, (handle) => {
      const { rightAngle: _rightAngle, ...unified } = handle;
      return unified;
    });
  };

  const toggleSelectedGeneratedHandleWeightLock = () => {
    if (!selectedGeneratedHandle) return;

    pushUndoSnapshot();
    updateGeneratedHandle(selectedGeneratedHandle.segmentId, selectedGeneratedHandle.frame, (handle) =>
      handle.weightLocked
        ? { ...handle, weightLocked: false }
        : { ...handle, weightLocked: true, leftLength: handle.leftLength, rightLength: handle.leftLength },
    );
  };

  const getPlotDataFromClient = (clientX: number, clientY: number) => {
    const surface = plotSurfaceRef.current;
    if (!surface) return null;

    const rect = surface.getBoundingClientRect();
    const xPercent = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const yPercent = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    const frame = visibleRange.start + (xPercent / 100) * visibleFrameSpan;
    const value = yRange.min + ((92 - yPercent) / 84) * Math.max(yRange.max - yRange.min, 1);

    return { frame, value };
  };

  const handleGeneratedHandlePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    frame: number,
    side: GeneratedHandleSide,
  ) => {
    if (!selectedGeneratedSegment || !selectedAxisRecord || event.button !== 0) return;
    if (kKeyRef.current) return;

    const centerValue = selectedAxisRecord.values[frame];
    if (!isMotionNumber(centerValue)) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    generatedHandleDragRef.current = {
      centerFrame: frame,
      centerValue,
      frame,
      segmentId: selectedGeneratedSegment.id,
      side,
      moved: false,
    };
    setSelectedGeneratedHandle({ frame, segmentId: selectedGeneratedSegment.id });
    setSelectedNode(null);
    setSelectedNodes([]);
    setNodeSelectionKind(null);
    setIsDraggingGeneratedHandle(true);
  };

  const handleGeneratedHandlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = generatedHandleDragRef.current;
    if (!drag) return;

    const pointer = getPlotDataFromClient(event.clientX, event.clientY);
    if (!pointer) return;

    const length =
      drag.side === "right"
        ? Math.max(0.1, pointer.frame - drag.centerFrame)
        : Math.max(0.1, drag.centerFrame - pointer.frame);
    const tangentRise = drag.side === "right" ? pointer.value - drag.centerValue : drag.centerValue - pointer.value;
    const angle = Math.atan2(tangentRise, framesToSeconds(length)) * (180 / Math.PI);

    if (!drag.moved) {
      pushUndoSnapshot();
      drag.moved = true;
    }

    updateGeneratedHandle(drag.segmentId, drag.frame, (handle) => {
      const isBroken = handle.rightAngle !== undefined;
      const angleUpdate = drag.side === "right" && isBroken ? { rightAngle: angle } : { angle };
      const lengthUpdate = handle.weightLocked
        ? { leftLength: length, rightLength: length }
        : { [drag.side === "right" ? "rightLength" : "leftLength"]: length };

      return { ...handle, ...angleUpdate, ...lengthUpdate };
    });
  };

  const handleGeneratedHandlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    generatedHandleDragRef.current = null;
    setIsDraggingGeneratedHandle(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Maya Insert Key Tool 파리티: 플롯 더블클릭으로 해당 프레임에 커브 값 유지 키 삽입.
  const handlePlotDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (selectedAxis === null) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    insertKeyAtFrame(visibleRange.start + ratio * visibleFrameSpan);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2) {
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu(null);
    }

    if (event.button === 0 && kKeyRef.current) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      playheadDragRef.current = true;
      setIsDraggingPlayhead(true);
      setPlayheadFromClientX(event.clientX, event.currentTarget);
      return;
    }

    if (
      event.button === 2 &&
      !copiedNodeRangeCandidateTarget &&
      !copiedGeneratedSegmentPasteTarget &&
      selectedAxisRecord &&
      activeSelectedNodes.length === 1
    ) {
      const targetNode = activeSelectedNodes[0];
      const targetValue =
        targetNode.axisIndex === selectedAxisRecord.index && isMotionNumber(selectedAxisRecord.values[targetNode.frame])
          ? selectedAxisRecord.values[targetNode.frame]
          : null;

      if (targetValue === null) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const rect = event.currentTarget.getBoundingClientRect();
      nodeValueDragRef.current = {
        axisIndex: targetNode.axisIndex,
        frame: targetNode.frame,
        startValue: targetValue,
        startY: event.clientY,
        degreesPerPixel: Math.max(yRange.max - yRange.min, 0.0001) / rect.height,
        moved: false,
      };
      setIsDraggingNodeValue(true);
      return;
    }

    if (event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        start: visibleRange.start,
        end: visibleRange.end,
        yMin: yRange.min,
        yMax: yRange.max,
      };
      setIsPanning(true);
      return;
    }

    if (event.button === 0 && selectedAxis !== null) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const point = getPlotPointerPercent(event);
      const nextSelection = {
        axisIndex: selectedAxis,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      };

      boxSelectRef.current = nextSelection;
      setSelectionRect(buildSelectionRect(nextSelection));
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (playheadDragRef.current) {
      setPlayheadFromClientX(event.clientX, event.currentTarget);
      return;
    }

    const nodeValueDrag = nodeValueDragRef.current;
    if (nodeValueDrag) {
      event.preventDefault();
      const nextValue = nodeValueDrag.startValue - (event.clientY - nodeValueDrag.startY) * nodeValueDrag.degreesPerPixel;

      if (!nodeValueDrag.moved) {
        pushUndoSnapshot();
        nodeValueDrag.moved = true;
      }

      updateNodeValue(nodeValueDrag.axisIndex, nodeValueDrag.frame, applyValueSnap(nextValue));
      return;
    }

    const boxSelection = boxSelectRef.current;
    if (boxSelection) {
      const point = getPlotPointerPercent(event);
      const nextSelection = {
        ...boxSelection,
        currentX: point.x,
        currentY: point.y,
      };

      boxSelectRef.current = nextSelection;
      setSelectionRect(buildSelectionRect(nextSelection));
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xSpan = drag.end - drag.start;
    const ySpan = Math.max(drag.yMax - drag.yMin, 0.0001);
    const totalDeltaX = event.clientX - drag.x;
    const totalDeltaY = event.clientY - drag.y;
    const axisLock = event.shiftKey ? (Math.abs(totalDeltaX) >= Math.abs(totalDeltaY) ? "time" : "value") : null;

    if (axisLock !== "value") {
      const framesPerPixel = xSpan / rect.width;
      const deltaFrames = totalDeltaX * framesPerPixel;
      const nextStart = drag.start - deltaFrames;
      applyVisibleRange(
        frameCount > 1 ? clampRange(nextStart, xSpan, timelineMaxIndex) : clampFreeRange(nextStart, xSpan),
      );
    }

    if (axisLock !== "time") {
      const deltaDegrees = totalDeltaY * (ySpan / rect.height);
      setYRange({
        min: drag.yMin + deltaDegrees,
        max: drag.yMax + deltaDegrees,
      });
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (playheadDragRef.current) {
      playheadDragRef.current = false;
      setIsDraggingPlayhead(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const boxSelection = boxSelectRef.current;
    if (boxSelection) {
      const rect = buildSelectionRect(boxSelection);
      const shouldSelect = rect.width > 0.5 || rect.height > 0.5;

      if (shouldSelect && selectedAxisRecord?.index === boxSelection.axisIndex) {
        const selectionStartFrame = Math.max(
          0,
          Math.ceil(visibleRange.start + (rect.left / 100) * visibleFrameSpan),
        );
        const selectionEndFrame = Math.min(
          selectedAxisRecord.values.length - 1,
          Math.floor(visibleRange.start + ((rect.left + rect.width) / 100) * visibleFrameSpan),
        );
        const nextSelectedNodes =
          selectionEndFrame >= selectionStartFrame
            ? selectedAxisRecord.values
                .map((value, frame) =>
                  frame >= selectionStartFrame && frame <= selectionEndFrame && isMotionNumber(value)
                    ? { axisIndex: boxSelection.axisIndex, frame }
                    : null,
                )
                .filter((node): node is SelectedNode => node !== null)
            : [];

        setSelectedNodes(nextSelectedNodes);
        setSelectedNode(nextSelectedNodes[0] ?? null);
        setNodeSelectionKind(nextSelectedNodes.length > 0 ? "range" : null);
        setSelectedGeneratedHandle(null);
        if (nextSelectedNodes.length === 1) {
          syncNodeDegreeInput(selectedAxisRecord.values[nextSelectedNodes[0].frame]);
        }
      }

      boxSelectRef.current = null;
      setSelectionRect(null);
    }

    if (dragRef.current) {
      dragRef.current = null;
      setIsPanning(false);
    }

    if (nodeValueDragRef.current) {
      nodeValueDragRef.current = null;
      setIsDraggingNodeValue(false);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };


  const primaryNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;
  const primaryNodeValue =
    primaryNode && selectedAxisRecord && isMotionNumber(selectedAxisRecord.values[primaryNode.frame])
      ? (selectedAxisRecord.values[primaryNode.frame] as number)
      : null;
  const toolbarFrame =
    primaryNode !== null
      ? formatStatNumber(primaryNode.frame)
      : activeSelectedNodes.length > 1
        ? `${activeSelectedNodes.length} sel`
        : "—";
  const toolbarValue = primaryNodeValue === null ? "—" : formatStatNumber(primaryNodeValue);
  const toolbarAngle = selectedGeneratedHandlePosition
    ? formatStatNumber(selectedGeneratedHandlePosition.angle)
    : "—";
  const rootLabel = fileName ? fileName.replace(/\.csv$/i, "") : "motion";
  const selectedAxisArrayIndex =
    selectedAxis === null ? -1 : axes.findIndex((candidate) => candidate.index === selectedAxis);
  const selectedAxisColor =
    selectedAxisArrayIndex >= 0 ? axisColors[selectedAxisArrayIndex % axisColors.length] : "#7a7a7a";
  const selectedAxisSegments =
    selectedAxis === null ? [] : generatedSegments.filter((segment) => segment.axisIndex === selectedAxis);
  const selectedAxisEasing = selectedAxisSegments.length
    ? generatedSegmentLabels[selectedAxisSegments[selectedAxisSegments.length - 1].mode]
    : "None";
  const activeTangentTool =
    selectedGeneratedSegment?.mode === "spline" ||
    selectedGeneratedSegment?.mode === "linear" ||
    selectedGeneratedSegment?.mode === "flat" ||
    selectedGeneratedSegment?.mode === "stepped"
      ? selectedGeneratedSegment.mode
      : null;

  const tangentTools: Array<{
    id: string;
    title: string;
    path: string;
    join?: boolean;
    dead?: boolean;
    disabled?: boolean;
    mode?: GeneratedSegmentMode;
  }> = [
    {
      id: "spline",
      title: "Spline Tangents (generate spline from a ctrl-selection)",
      path: "M2 12C5 12 5 4 8 8s3 4 6-4",
      disabled: !canGenerateSpline,
      mode: "spline",
    },
    { id: "clamped", title: "Clamped Tangents (decorative)", path: "M2 11h2C7 11 6 5 9 5s3 0 5 0", dead: true },
    {
      id: "linear",
      title: "Linear Tangents (generate linear from a ctrl-selection)",
      path: "M2 13L14 3",
      disabled: !canGenerateSegment,
      mode: "linear",
    },
    {
      id: "flat",
      title: "Flat Tangents (generate flat/smoothstep from a ctrl-selection)",
      path: "M2 8h12",
      disabled: !canGenerateSegment,
      mode: "flat",
    },
    {
      id: "stepped",
      title: "Stepped Tangents (generate stepped from a ctrl-selection)",
      path: "M2 12h5V5h7",
      join: true,
      disabled: !canGenerateSegment,
      mode: "stepped",
    },
    { id: "plateau", title: "Plateau Tangents (decorative)", path: "M2 11C5 11 5 5 8 5s3 6 6 6", dead: true },
  ];

  return (
    <div className="geRoot">
      {/* ============ MENU BAR ============ */}
      <div className="geMenu">
        <div className="geBrand">
          <span className="geBrandDot" />
          Graph Editor
        </div>
        <div className="geVDiv" />
        <div className="geMenuItems">
          {["Edit", "View", "Select", "Curves", "Keys", "Tangents", "List", "Show"].map((label) => (
            <span className="geMenuItem" key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="geSpacer" />
        <div className={error ? "geMeta error" : "geMeta"}>
          {error || (fileName
            ? `${serverRelativePath ? "server: " : ""}${fileName}  ·  ${axes.length} axes  ·  ${frameCount} frames`
            : "no file")}
        </div>
        <div className="geMenuBtns">
          <button className="geMenuBtn" type="button" onClick={() => fileInputRef.current?.click()}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.6">
              <path d="M8 11V3M8 3L5 6M8 3l3 3" />
              <path d="M3 11v2h10v-2" />
            </svg>
            Open Client
          </button>
          <button className="geMenuBtn" type="button" onClick={() => void openServerBrowser()}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.6">
              <rect x="2" y="3" width="12" height="10" rx="1" />
              <path d="M5 3V2M11 3V2M2 7h12" />
            </svg>
            Open Server
          </button>
          <button
            className="geMenuBtn"
            type="button"
            title="CSV+편집 상태(meta)를 zip 하나로 저장 — 다른 PC로 이동 시 권장"
            onClick={() => void saveMotionBundle()}
            disabled={axes.length === 0}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.6">
              <path d="M3 2h8l3 3v9H3z" />
              <path d="M8 6v5M8 11l-2-2M8 11l2-2" />
            </svg>
            Save Bundle
          </button>
          <button
            className="geMenuBtn"
            type="button"
            title="순수 CSV만 저장 — 로봇 등 외부 소비자 전달용 (편집 상태 미포함)"
            onClick={() => void saveMotionCsv()}
            disabled={axes.length === 0}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.6">
              <path d="M3 2h8l3 3v9H3z" />
              <path d="M5 2v4h5V2M6 14v-4h4v4" />
            </svg>
            Export CSV
          </button>
          <button className="geMenuBtn primary" type="button" onClick={() => void saveMotionCsvToServer()} disabled={axes.length === 0}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#0d2733" strokeWidth="1.6">
              <path d="M3 2h8l3 3v9H3z" />
              <path d="M5 2v4h5V2M6 14v-4h4v4" />
            </svg>
            Save Server
          </button>
          <input
            ref={fileInputRef}
            className="hiddenInput"
            type="file"
            accept=".csv,text/csv,.json,application/json,.zip,application/zip"
            multiple
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ============ TOOLBAR ============ */}
      <div className="geToolbar">
        {tangentTools.map((tool) => {
          const mode = tool.mode;

          return (
          <button
            key={tool.id}
            type="button"
            title={tool.title}
            disabled={tool.dead || tool.disabled}
            className={["geTool", activeTangentTool === tool.id ? "active" : "", tool.dead ? "dead" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={mode ? () => generateMotionData(mode) : undefined}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#d0d0d0"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin={tool.join ? "round" : undefined}
            >
              <path d={tool.path} />
            </svg>
          </button>
          );
        })}

        <div className="geTDiv" />

        {/* key ops */}
        <button className="geTool" type="button" title="Add Key" disabled={!canAddNode} onClick={addNodeToSelectedAxis}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#8bd17c" strokeWidth="1.7" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button className="geTool" type="button" title="Delete Key" disabled={!canDeleteNode} onClick={deleteSelectedNodes}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#dd7d6f" strokeWidth="1.7" strokeLinecap="round">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button
          className="geTool"
          type="button"
          title="Cut Axis at Playhead"
          disabled={!canCutSelectedAxis}
          onClick={cutSelectedAxisAtPlayhead}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4">
            <circle cx="4" cy="11" r="2" />
            <circle cx="12" cy="11" r="2" />
            <path d="M5.5 9.5L13 3M10.5 9.5L3 3" />
          </svg>
        </button>

        <div className="geTDiv" />

        <button
          className="geTool"
          type="button"
          title="Buffer Curve Snapshot (현재 커브를 고스트로 저장)"
          disabled={!selectedAxisRecord}
          onClick={snapshotBufferCurve}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4">
            <rect x="2" y="5" width="9" height="9" rx="1" />
            <path d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2" />
          </svg>
        </button>
        <button
          className={showBufferCurves ? "geTool active" : "geTool"}
          type="button"
          title="Show/Hide Buffer Curves"
          disabled={Object.keys(bufferCurves).length === 0}
          onClick={toggleShowBufferCurves}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4">
            <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        </button>
        <button
          className="geTool"
          type="button"
          title="Swap Buffer Curve (버퍼 ↔ 현재 커브)"
          disabled={!hasSelectedAxisBuffer}
          onClick={swapBufferCurve}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 5h10l-2.5-2.5M14 11H4l2.5 2.5" />
          </svg>
        </button>
        <button
          className={isolateSelectedAxis ? "geTool active" : "geTool"}
          type="button"
          title="Isolate Selected Axis (선택 축만 표시)"
          disabled={selectedAxis === null && !isolateSelectedAxis}
          onClick={toggleIsolateSelectedAxis}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4">
            <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
            <path d="M4.5 8s1.3-2.3 3.5-2.3S11.5 8 11.5 8s-1.3 2.3-3.5 2.3S4.5 8 4.5 8Z" />
          </svg>
        </button>
        <button
          className={snapValues ? "geTool active" : "geTool"}
          type="button"
          title="Snap Values (드래그 값 정수 스냅)"
          onClick={toggleSnapValues}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d0d0d0" strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 2v6a4 4 0 0 0 8 0V2" />
            <path d="M4 2h3M9 2h3" />
            <path d="M4 5h3M9 5h3" strokeWidth="1.1" />
          </svg>
        </button>

        <div className="geTDiv" />

        {/* stats */}
        <span className="geStatLbl">Frame</span>
        <input
          key={`toolbar-frame-${primaryNode?.axisIndex ?? "none"}-${primaryNode?.frame ?? "none"}`}
          defaultValue={primaryNode ? String(primaryNode.frame) : toolbarFrame}
          disabled={!primaryNode || selectedGeneratedSegment !== null}
          className="geStatIn"
          style={{ width: 64 }}
          onBlur={(event) => commitNodeFrameInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
        />
        <span className="geStatLbl" style={{ marginLeft: 8 }}>
          Value
        </span>
        <input
          value={activeSelectedNodes.length > 0 ? nodeDegreeInput : toolbarValue}
          disabled={activeSelectedNodes.length === 0}
          className="geStatIn"
          style={{ width: 82, color: "#4ca6d6" }}
          onChange={(event) => handleNodeDegreeInputChange(event.target.value)}
          onBlur={commitNodeDegreeInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
        />
        <span className="geUnit">deg</span>

        <div className="geTDiv" />

        <span className="geStatLbl">In / Out &ang;</span>
        <input readOnly value={toolbarAngle} className="geStatIn" style={{ width: 64, color: "#e8912a" }} />

        <div className="geSpacer" />

        <button className="geTool" type="button" title="Undo" disabled={undoDepth === 0} onClick={undoLastEdit}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h6a3 3 0 010 6M4 8l3-3M4 8l3 3" />
          </svg>
        </button>
        <button className="geTool" type="button" title="Redo" disabled={redoDepth === 0} onClick={redoLastEdit}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8H6a3 3 0 000 6M12 8l-3-3M12 8l-3 3" />
          </svg>
        </button>
        <div className="geTDiv" />
        <button
          className="geTool"
          type="button"
          title="Frame Selection"
          disabled={!hasFrameSelectionTarget}
          onClick={focusSelectedAxisAtPlayhead}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.4">
            <rect x="3" y="3" width="10" height="10" rx="1" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        </button>
        <button className="geTool" type="button" title="Frame All" onClick={fitGraph}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3H3v3M13 6V3h-3M10 13h3v-3M3 10v3h3" />
          </svg>
        </button>
        <button className="geTool" type="button" title="Frame Playback Range" onClick={framePlaybackRange}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#7ec24f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3H3v3M13 6V3h-3M10 13h3v-3M3 10v3h3" />
            <path d="M6 8h4" />
          </svg>
        </button>
      </div>

      {/* ============ MAIN ROW ============ */}
      <div className="geMain">
        {/* ---- OUTLINER ---- */}
        <div className="geOutliner">
          <div className="gePanelHdr">
            OUTLINER
            <span className="geAxisOps">
              <button type="button" title="New axis" onClick={addAxis}>
                +
              </button>
              <button type="button" title="Delete axis" disabled={selectedAxis === null} onClick={deleteSelectedAxis}>
                &minus;
              </button>
            </span>
          </div>

          <div className="geTree" onContextMenu={handleAxisListContextMenu}>
            <div className="geTreeRoot">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="#c8c8c8">
                <path d="M2 1l5 4-5 4z" />
              </svg>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#c8a05a" strokeWidth="1.4">
                <path d="M2 4h4l1.5 2H14v7H2z" />
              </svg>
              <span className="geTreeRootName" title={rootLabel}>
                {rootLabel}
              </span>
              <span className="geTreeRootCount">{frameCount || ""}</span>
            </div>

            {axes.map((axis, index) => (
              <button
                key={axis.index}
                type="button"
                title={formatAxisDisplayName(axis)}
                className={selectedAxis === axis.index ? "geAxisRow active" : "geAxisRow"}
                onClick={() => selectAxis(axis.index)}
                onContextMenu={(event) => handleAxisRowContextMenu(event, axis.index)}
              >
                <span
                  role="button"
                  aria-label={hiddenAxes.has(axis.index) ? "Show axis in plot" : "Hide axis in plot"}
                  className={hiddenAxes.has(axis.index) ? "geAxisEye off" : "geAxisEye"}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleAxisVisibility(axis.index);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                </span>
                <span className="geSwatch" style={{ background: axisColors[index % axisColors.length] }} />
                <span className="geAxisName">Axis {formatAxisDisplayName(axis)}</span>
                <span className="geAxisTag">rotate</span>
              </button>
            ))}
          </div>

          {/* Channel box */}
          <div className="geChannel">
            <div className="geChannelHdr">
              CHANNEL <span className="geSwatch" style={{ background: selectedAxisColor }} />
              <span className="geChannelName">{selectedAxisRecord ? `Axis ${selectedAxisDisplayName}` : "—"}</span>
            </div>
            <div className="geChannelGrid">
              <span className="geChKey">Nodes</span>
              <span className="geChVal">{selectedAxisStats ? formatStatNumber(selectedAxisStats.nodeCount) : "—"}</span>
              <span className="geChKey">Max</span>
              <span className="geChVal">
                {selectedAxisStats ? formatStatNumber(selectedAxisStats.maxValue) : "—"} <span className="geUnit">deg</span>
              </span>
              <span className="geChKey">Min</span>
              <span className="geChVal">
                {selectedAxisStats ? formatStatNumber(selectedAxisStats.minValue) : "—"} <span className="geUnit">deg</span>
              </span>
              <span className="geChKey">Easing</span>
              <span className="geChVal" style={{ color: selectedAxisColor }}>
                {selectedAxisEasing}
              </span>
            </div>
          </div>
        </div>

        {/* ---- GRAPH ---- */}
        <div className="geGraph">
          <div
            className="geRuler"
            onWheel={handleWheel}
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerEnd}
            onPointerCancel={handleRulerPointerEnd}
          >
            {isPlaybackRangeVisible ? (
              <div
                className="playbackRangeBar"
                style={{ left: `${playbackRangeStartPct}%`, width: `${Math.max(playbackRangeEndPct - playbackRangeStartPct, 0)}%` }}
              />
            ) : null}
            {frameMarks.map((mark) => (
              <span className="geRulerLbl" key={`${mark.frame}-${mark.x}`} style={{ left: `${mark.x}%` }}>
                {formatFrameTime(mark.frame)}
              </span>
            ))}
            <button
              aria-label={`Playback range start ${formatFrameTime(playbackRange.start)}`}
              className="playbackRangeHandle start"
              type="button"
              style={{ left: `${playbackRangeStartPct}%` }}
              onPointerDown={(event) => handlePlaybackRangeHandlePointerDown(event, "start")}
              onPointerMove={handlePlaybackRangeHandlePointerMove}
              onPointerUp={handlePlaybackRangeHandlePointerEnd}
              onPointerCancel={handlePlaybackRangeHandlePointerEnd}
            />
            <button
              aria-label={`Playback range end ${formatFrameTime(playbackRange.end)}`}
              className="playbackRangeHandle end"
              type="button"
              style={{ left: `${playbackRangeEndPct}%` }}
              onPointerDown={(event) => handlePlaybackRangeHandlePointerDown(event, "end")}
              onPointerMove={handlePlaybackRangeHandlePointerMove}
              onPointerUp={handlePlaybackRangeHandlePointerEnd}
              onPointerCancel={handlePlaybackRangeHandlePointerEnd}
            />
            {isPlayheadVisible ? (
              <button
                aria-label={`Current time ${formatFrameTime(displayedCurrentFrame)}`}
                className={playheadRulerClassName}
                type="button"
                style={{ left: `${playheadPosition}%` }}
                onPointerDown={handlePlayheadPointerDown}
                onPointerMove={handlePlayheadPointerMove}
                onPointerUp={handlePlayheadPointerEnd}
                onPointerCancel={handlePlayheadPointerEnd}
              >
                {formatFrameTime(displayedCurrentFrame)}
              </button>
            ) : null}
          </div>

          <div
            className={
              isDraggingNodeValue
                ? "plotSurface gefill editingNodeValue"
                : isPanning
                  ? "plotSurface gefill panning"
                  : isDraggingGeneratedHandle
                    ? "plotSurface gefill editingHandle"
                    : "plotSurface gefill"
            }
            ref={plotSurfaceRef}
            onWheel={handleYWheel}
            onContextMenu={handlePlotContextMenu}
            onDoubleClick={handlePlotDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <svg className="curveSvg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
              {frameMarks.map((mark) => (
                <line
                  key={`grid-v-${mark.x}`}
                  x1={mark.x}
                  x2={mark.x}
                  y1="0"
                  y2="100"
                  stroke="#333333"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {yMarks.map((mark) => (
                <line
                  key={`grid-h-${mark.value}`}
                  x1="0"
                  x2="100"
                  y1={mark.y}
                  y2={mark.y}
                  stroke="#313131"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1="0"
                x2="100"
                y1={92 - ((0 - yRange.min) / Math.max(yRange.max - yRange.min, 1)) * 84}
                y2={92 - ((0 - yRange.min) / Math.max(yRange.max - yRange.min, 1)) * 84}
                stroke="#4d4d4d"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />

              {isSelectedAxisPlotVisible
                ? bufferCurvePolylines.map((points, bufferIndex) => (
                    <polyline className="bufferCurve" key={`buffer-${bufferIndex}`} points={points} />
                  ))
                : null}

              {renderedAxes.map((axis) => {
                if (!isAxisVisibleInPlot(axis.index)) return null;

                const axisIndex = axes.findIndex((candidate) => candidate.index === axis.index);
                const segments = toPlotSegments(axis.values, visibleRange, yRange.min, yRange.max);
                const generatedAxisSegments = generatedSegments.filter(
                  (segment) =>
                    segment.axisIndex === axis.index &&
                    segment.endFrame >= visibleRange.start &&
                    segment.startFrame <= visibleRange.end,
                );
                const isSelected = selectedAxis === axis.index;
                const hasSelection = selectedAxis !== null;

                return (
                  <g key={axis.index} className={hasSelection && !isSelected ? "axisGroup dimmed" : "axisGroup"}>
                    {segments.map((points, segmentIndex) => (
                      <polyline
                        points={toPolyline(points)}
                        className={isSelected ? "axisCurve selected" : "axisCurve"}
                        key={`${axis.index}-${segmentIndex}`}
                        style={{ stroke: isSelected ? "#ffd34f" : axisColors[axisIndex % axisColors.length] }}
                      />
                    ))}
                    {generatedAxisSegments.map((generatedSegment) => {
                      const points = toGeneratedSegmentPoints(
                        axis.values,
                        visibleRange,
                        yRange.min,
                        yRange.max,
                        generatedSegment,
                      );

                      if (points.length < 2) return null;

                      const segmentKey = generatedSegmentKey(generatedSegment);
                      const segmentColor =
                        selectedGeneratedSegmentKey === segmentKey
                          ? SELECTED_GENERATED_SEGMENT_COLOR
                          : GENERATED_SEGMENT_COLOR;

                      return (
                        <polyline
                          points={toPolyline(points)}
                          className="generatedCurve"
                          key={segmentKey}
                          style={{ stroke: segmentColor }}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {isSelectedAxisPlotVisible && infinityPreview?.prePoints ? (
                <polyline className="infinityCurve" points={infinityPreview.prePoints} />
              ) : null}
              {isSelectedAxisPlotVisible && infinityPreview?.postPoints ? (
                <polyline className="infinityCurve" points={infinityPreview.postPoints} />
              ) : null}
            </svg>

            {yMarks.map((mark) => (
              <span className="geValLbl" key={`val-${mark.value}`} style={{ top: `${mark.y}%` }}>
                {formatDegree(mark.value)}
              </span>
            ))}
            <span className="geValUnit">deg</span>

            {isPlayheadVisible ? (
              <button
                aria-label={`Current time ${formatFrameTime(displayedCurrentFrame)}`}
                className={playheadOverlayClassName}
                type="button"
                style={{ left: `${playheadPosition}%` }}
                onPointerDown={handlePlayheadPointerDown}
                onPointerMove={handlePlayheadPointerMove}
                onPointerUp={handlePlayheadPointerEnd}
                onPointerCancel={handlePlayheadPointerEnd}
              />
            ) : null}
            {selectionRect ? (
              <div
                className="selectionBox"
                style={{
                  left: `${selectionRect.left}%`,
                  top: `${selectionRect.top}%`,
                  width: `${selectionRect.width}%`,
                  height: `${selectionRect.height}%`,
                }}
              />
            ) : null}
            <div className="nodeOverlay">
              {regionScaleRect && isSelectedAxisPlotVisible ? (
                <div
                  className="regionScaleBox"
                  style={{
                    left: `${regionScaleRect.left}%`,
                    top: `${regionScaleRect.top}%`,
                    width: `${regionScaleRect.width}%`,
                    height: `${Math.max(regionScaleRect.height, 0)}%`,
                  }}
                >
                  <button
                    aria-label="Scale keys from left edge"
                    className="regionScaleHandle left"
                    type="button"
                    onPointerDown={(event) => handleRegionScalePointerDown(event, "left")}
                  />
                  <button
                    aria-label="Scale keys from right edge"
                    className="regionScaleHandle right"
                    type="button"
                    onPointerDown={(event) => handleRegionScalePointerDown(event, "right")}
                  />
                  {regionScaleRect.hasValueSpan ? (
                    <>
                      <button
                        aria-label="Scale key values from top edge"
                        className="regionScaleHandle top"
                        type="button"
                        onPointerDown={(event) => handleRegionScalePointerDown(event, "top")}
                      />
                      <button
                        aria-label="Scale key values from bottom edge"
                        className="regionScaleHandle bottom"
                        type="button"
                        onPointerDown={(event) => handleRegionScalePointerDown(event, "bottom")}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
              {selectedAxis !== null && isSelectedAxisPlotVisible
                ? renderedSelectedAxisNodePoints.map((point) => {
                    const node = { axisIndex: selectedAxis, frame: point.frame };
                    const currentNodeKey = nodeKey(node);
                    const isPrimarySelected = primarySelectedNodeKey === currentNodeKey;
                    const isSecondarySelected = !isPrimarySelected && selectedNodeKeys.has(currentNodeKey);
                    const isRangeSelected = nodeSelectionKind === "range" && selectedNodeKeys.has(currentNodeKey);
                    const isSelectedNode = isPrimarySelected || selectedNodeKeys.has(currentNodeKey);
                    const selectedAxisValue = selectedAxisRecord?.values[point.frame];
                    const isOtherAxisEndMatch =
                      isSelectedNode &&
                      selectedAxis !== null &&
                      isMotionNumber(selectedAxisValue) &&
                      hasOtherAxisMatchingEndNode(axes, selectedAxis, point.frame, selectedAxisValue);
                    const isDisconnectedNode = disconnectedFrameSet.has(point.frame);
                    const markerSize =
                      !shouldShowAllNodeMarkers && isDisconnectedNode
                        ? nodeMarkerSize * DISCONNECTED_NODE_MARKER_MULTIPLIER
                        : nodeMarkerSize;
                    const generatedHandle = generatedKeyHandles.get(point.frame);
                    const isGeneratedKeyPoint = generatedHandle !== undefined;
                    const isSelectedGeneratedHandle =
                      selectedGeneratedHandle !== null &&
                      selectedGeneratedSegment !== null &&
                      selectedGeneratedHandle.segmentId === selectedGeneratedSegment.id &&
                      selectedGeneratedHandle.frame === point.frame;
                    const nodeClassName = [
                      isGeneratedKeyPoint
                        ? isSelectedGeneratedHandle
                          ? "keyNode generatedKeyPoint selectedHandle"
                          : "keyNode generatedKeyPoint"
                        : isRangeSelected
                          ? "keyNode selected range"
                          : isPrimarySelected
                            ? "keyNode selected primary"
                            : isSecondarySelected
                              ? "keyNode selected secondary"
                              : "keyNode activeAxis",
                      isOtherAxisEndMatch ? "otherAxisEndMatch" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <Fragment key={`${selectedAxis}-${point.frame}`}>
                        {generatedHandle ? (
                          <svg className="generatedKeyHandleSvg" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <line
                              x1={generatedHandle.left.x}
                              y1={generatedHandle.left.y}
                              x2={generatedHandle.center.x}
                              y2={generatedHandle.center.y}
                              className="generatedKeyHandleLine"
                            />
                            <line
                              x1={generatedHandle.center.x}
                              y1={generatedHandle.center.y}
                              x2={generatedHandle.right.x}
                              y2={generatedHandle.right.y}
                              className="generatedKeyHandleLine"
                            />
                          </svg>
                        ) : null}
                        {generatedHandle ? (
                          <button
                            aria-label={`Adjust left handle at frame ${point.frame}`}
                            className={
                              isSelectedGeneratedHandle
                                ? "generatedKeyHandleDot selected"
                                : "generatedKeyHandleDot"
                            }
                            type="button"
                            style={{ left: `${generatedHandle.left.x}%`, top: `${generatedHandle.left.y}%` }}
                            onPointerDown={(event) => handleGeneratedHandlePointerDown(event, point.frame, "left")}
                            onPointerMove={handleGeneratedHandlePointerMove}
                            onPointerUp={handleGeneratedHandlePointerEnd}
                            onPointerCancel={handleGeneratedHandlePointerEnd}
                          />
                        ) : null}
                        {generatedHandle ? (
                          <button
                            aria-label={`Adjust right handle at frame ${point.frame}`}
                            className={
                              isSelectedGeneratedHandle
                                ? "generatedKeyHandleDot selected"
                                : "generatedKeyHandleDot"
                            }
                            type="button"
                            style={{ left: `${generatedHandle.right.x}%`, top: `${generatedHandle.right.y}%` }}
                            onPointerDown={(event) => handleGeneratedHandlePointerDown(event, point.frame, "right")}
                            onPointerMove={handleGeneratedHandlePointerMove}
                            onPointerUp={handleGeneratedHandlePointerEnd}
                            onPointerCancel={handleGeneratedHandlePointerEnd}
                          />
                        ) : null}
                        <button
                          aria-label={`Select frame ${point.frame}`}
                          className={nodeClassName}
                          type="button"
                          style={{
                            height: `${markerSize}px`,
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                            width: `${markerSize}px`,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();

                            if (justDraggedNodeFrameRef.current) {
                              justDraggedNodeFrameRef.current = false;
                              return;
                            }

                            if (event.ctrlKey && selectedGeneratedSegment === null) {
                              if (selectedNodeKeys.has(currentNodeKey)) {
                                const nextSelectedNodes = selectedNodes.filter(
                                  (selected) => nodeKey(selected) !== currentNodeKey,
                                );
                                const nextSelectedNode =
                                  primarySelectedNodeKey === currentNodeKey
                                    ? nextSelectedNodes[0] ?? null
                                    : selectedNode;

                                setSelectedNode(nextSelectedNode);
                                setSelectedNodes(nextSelectedNodes);
                                setNodeSelectionKind(nextSelectedNodes.length > 1 ? "ctrl" : nextSelectedNode ? "single" : null);
                                setSelectedGeneratedHandle(null);
                                if (nextSelectedNode) {
                                  syncNodeDegreeInput(selectedAxisRecord?.values[nextSelectedNode.frame]);
                                }
                                return;
                              }

                              const nextSelectedNodes = [
                                ...selectedNodes.filter((selected) => selected.axisIndex === node.axisIndex),
                                node,
                              ];
                              const nextSelectedNode = selectedNode?.axisIndex === node.axisIndex ? selectedNode : node;

                              setSelectedNode(nextSelectedNode);
                              setSelectedNodes(nextSelectedNodes);
                              setNodeSelectionKind(nextSelectedNodes.length > 1 ? "ctrl" : "single");
                              setSelectedGeneratedHandle(null);
                              syncNodeDegreeInput(selectedAxisRecord?.values[nextSelectedNode.frame]);
                              return;
                            }

                            const isAlreadySelected = isPrimarySelected && selectedNodes.length === 1;

                            if (isAlreadySelected) {
                              setSelectedNode(null);
                              setSelectedNodes([]);
                              setNodeSelectionKind(null);
                              setSelectedGeneratedHandle(null);
                              return;
                            }

                            setSelectedNode(node);
                            setSelectedNodes([node]);
                            setNodeSelectionKind("single");
                            setSelectedGeneratedHandle(null);
                            syncNodeDegreeInput(selectedAxisRecord?.values[node.frame]);
                          }}
                          onPointerDown={(event) => handleKeyNodePointerDown(event, node)}
                        />
                      </Fragment>
                    );
                  })
                : null}
            </div>
          </div>
        </div>

        {/* ---- RIGHT INFO ---- */}
        <div className="geRight">
          <div className="gePanelHdr">
            TANGENT
            <span className="gePanelHdrMeta">
              {selectedGeneratedHandle && selectedGeneratedHandleSegment
                ? `index ${selectedGeneratedHandle.frame}`
                : "no handle"}
            </span>
          </div>
          <div className="geFields">
            <label className="geField">
              <span>In &ang;</span>
              <input
                type="number"
                step="0.1"
                disabled={!selectedGeneratedHandlePosition}
                style={{ color: "#e8912a" }}
                value={selectedGeneratedHandlePosition ? formatStatNumber(selectedGeneratedHandlePosition.angle) : ""}
                onChange={(event) => updateSelectedGeneratedHandleField("angle", event.target.value)}
              />
              <span className="geUnit">deg</span>
            </label>
            <label className="geField">
              <span>Out &ang;</span>
              <input
                type="number"
                step="0.1"
                disabled={!selectedGeneratedHandlePosition || !isSelectedGeneratedHandleBroken}
                style={{ color: "#e8912a" }}
                value={
                  selectedGeneratedHandlePosition
                    ? formatStatNumber(
                        selectedGeneratedHandlePosition.rightAngle ?? selectedGeneratedHandlePosition.angle,
                      )
                    : ""
                }
                onChange={(event) => updateSelectedGeneratedHandleField("rightAngle", event.target.value)}
              />
              <span className="geUnit">deg</span>
            </label>
            <div className="geKeyBtns">
              <button
                type="button"
                disabled={!selectedGeneratedHandlePosition || isSelectedGeneratedHandleBroken}
                onClick={breakSelectedGeneratedHandle}
              >
                Break
              </button>
              <button
                type="button"
                disabled={!selectedGeneratedHandlePosition || !isSelectedGeneratedHandleBroken}
                onClick={unifySelectedGeneratedHandle}
              >
                Unify
              </button>
            </div>
            <label className="geField">
              <span>In Weight</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                disabled={!selectedGeneratedHandlePosition}
                value={selectedGeneratedHandlePosition ? formatStatNumber(selectedGeneratedHandlePosition.leftLength) : ""}
                onChange={(event) => updateSelectedGeneratedHandleField("leftLength", event.target.value)}
              />
              <span className="geUnit">idx</span>
            </label>
            <label className="geField">
              <span>Out Weight</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                disabled={!selectedGeneratedHandlePosition}
                value={selectedGeneratedHandlePosition ? formatStatNumber(selectedGeneratedHandlePosition.rightLength) : ""}
                onChange={(event) => updateSelectedGeneratedHandleField("rightLength", event.target.value)}
              />
              <span className="geUnit">idx</span>
            </label>
            <div className="geKeyBtns">
              <button
                type="button"
                disabled={!selectedGeneratedHandlePosition}
                onClick={toggleSelectedGeneratedHandleWeightLock}
              >
                {selectedGeneratedHandlePosition?.weightLocked ? "Free Weight" : "Lock Weight"}
              </button>
            </div>
          </div>

          <div className="gePanelHdr">
            KEY
            <span className="gePanelHdrMeta">
              {activeSelectedNodes.length > 1
                ? `${activeSelectedNodes.length} selected`
                : primaryNode
                  ? `index ${primaryNode.frame}`
                  : "no key"}
            </span>
          </div>
          <div className="geFields">
            <label className="geField">
              <span>Frame</span>
              <input
                key={`key-frame-${primaryNode?.axisIndex ?? "none"}-${primaryNode?.frame ?? "none"}`}
                defaultValue={primaryNode ? String(primaryNode.frame) : toolbarFrame}
                disabled={!primaryNode || selectedGeneratedSegment !== null}
                onBlur={(event) => commitNodeFrameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                }}
              />
              <span className="geUnit">idx</span>
            </label>
            <label className="geField">
              <span>Value</span>
              <input
                type="text"
                title="숫자 절대값(모든 선택 키에 동일 적용) 또는 +=N / -=N 상대 오프셋"
                disabled={activeSelectedNodes.length === 0}
                style={{ color: "#4ca6d6" }}
                value={nodeDegreeInput}
                onChange={(event) => handleNodeDegreeInputChange(event.target.value)}
                onBlur={commitNodeDegreeInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                }}
              />
              <span className="geUnit">deg</span>
            </label>
            <div className="geKeyBtns">
              <button type="button" disabled={!canAddNode} onClick={addNodeToSelectedAxis}>
                Add
              </button>
              <button type="button" disabled={!canDeleteNode} onClick={deleteSelectedNodes}>
                Remove
              </button>
              <button type="button" disabled={!canShiftNode} onClick={shiftSelectedNodeToLeft}>
                Shift
              </button>
            </div>
            <label className="geField">
              <span>Pre &infin;</span>
              <select
                disabled={!selectedAxisRecord}
                value={selectedAxisInfinity.pre}
                onChange={(event) => setAxisInfinityMode("pre", event.target.value as InfinityMode)}
              >
                <option value="constant">Constant</option>
                <option value="cycle">Cycle</option>
                <option value="oscillate">Oscillate</option>
                <option value="linear">Linear</option>
              </select>
            </label>
            <label className="geField">
              <span>Post &infin;</span>
              <select
                disabled={!selectedAxisRecord}
                value={selectedAxisInfinity.post}
                onChange={(event) => setAxisInfinityMode("post", event.target.value as InfinityMode)}
              >
                <option value="constant">Constant</option>
                <option value="cycle">Cycle</option>
                <option value="oscillate">Oscillate</option>
                <option value="linear">Linear</option>
              </select>
            </label>
            <div className="geKeyBtns">
              <button
                type="button"
                disabled={!canBakeInfinity}
                title="Playback Range 구간에 ∞ 평가값을 실제 키로 굽기 (CSV 저장에 포함되려면 필수)"
                onClick={bakeInfinityToPlaybackRange}
              >
                Bake &infin;
              </button>
            </div>
          </div>
          <div className="geSpacerV" />
        </div>
      </div>

      {/* ============ SEGMENTS STRIP ============ */}
      <div className="geFooter">
        <div className="gePanelHdr">
          SEGMENTS <span className="gePanelHdrNote">generated easing segments per axis</span>
        </div>
        <div className="geSegScroll">
          {activeGeneratedSegments.length === 0 ? (
            <div className="geSegEmpty">No generated segments</div>
          ) : (
            activeGeneratedSegments.map((segment) => {
              const segmentKey = generatedSegmentKey(segment);
              const segmentAxis = axes.find((axis) => axis.index === segment.axisIndex);
              const segmentArrayIndex = axes.findIndex((axis) => axis.index === segment.axisIndex);
              const axisColor = segmentArrayIndex >= 0 ? axisColors[segmentArrayIndex % axisColors.length] : "#7a7a7a";
              const previewPoints = segmentAxis ? toGeneratedSegmentPreviewPoints(segmentAxis.values, segment) : [];
              const isSelectedSegment = selectedGeneratedSegmentKey === segmentKey;

              return (
                <button
                  key={segmentKey}
                  type="button"
                  className={isSelectedSegment ? "geSegCard active" : "geSegCard"}
                  onClick={() => selectGeneratedSegment(segment)}
                  onContextMenu={(event) => handleGeneratedSegmentContextMenu(event, segment)}
                >
                  <div className="geSegHdr">
                    <span className="geSwatch" style={{ background: axisColor }} />
                    <span className="geSegMode">{generatedSegmentLabels[segment.mode]}</span>
                    <span className="geSegAxis">Axis {formatAxisDisplayName(segmentAxis)}</span>
                  </div>
                  <svg className="geSegPreview" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
                    <line x1="0" x2="100" y1="32" y2="32" stroke="rgba(255,255,255,0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    {previewPoints.length > 1 ? (
                      <polyline
                        points={toPolyline(previewPoints)}
                        fill="none"
                        stroke={isSelectedSegment ? SELECTED_GENERATED_SEGMENT_COLOR : axisColor}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </svg>
                  <div className="geSegMeta">
                    <span>
                      {segment.startFrame} &ndash; {segment.endFrame}
                    </span>
                    <span>
                      {formatFrameTime(segment.startFrame)} &ndash; {formatFrameTime(segment.endFrame)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---- dialogs & context menus (unchanged behavior) ---- */}
      {saveGapDialog ? (
        <div className="saveGapDialogBackdrop" role="presentation">
          <div className="saveGapDialog" role="dialog" aria-modal="true" aria-labelledby="save-gap-title">
            <div className="saveGapDialogHeader">
              <span id="save-gap-title">Empty indices</span>
              <span>
                {saveGapDialog.missingCount} cells · {saveGapDialog.axesWithMissing} axes
              </span>
            </div>
            <div className="saveGapDialogBody">
              <label className="saveGapField">
                <span>Fill method</span>
                <select
                  value={saveGapMode}
                  onChange={(event) => setSaveGapMode(event.target.value as MissingValueSaveStrategy)}
                >
                  {saveGapModeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="saveGapDialogFooter">
              <span>{saveGapDialog.frameCount} frames will be written per axis.</span>
              <div className="saveGapActions">
                <button type="button" onClick={() => setSaveGapDialog(null)}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={handleGapDialogSave}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {axisRenameDialog ? (
        <div className="saveGapDialogBackdrop" role="presentation">
          <form
            className="saveGapDialog axisRenameDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="axis-rename-title"
            onSubmit={(event) => {
              event.preventDefault();
              applyAxisRename();
            }}
          >
            <div className="saveGapDialogHeader">
              <span id="axis-rename-title">Rename axis</span>
              <span>axis name</span>
            </div>
            <div className="saveGapDialogBody">
              <label className="saveGapField">
                <span>Name</span>
                <input
                  autoFocus
                  value={axisRenameDialog.value}
                  onChange={(event) =>
                    setAxisRenameDialog((current) =>
                      current ? { ...current, value: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>
            <div className="saveGapDialogFooter">
              <span>Leave empty to show the axis index.</span>
              <div className="saveGapActions">
                <button type="button" onClick={() => setAxisRenameDialog(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      {generationMenu ? (
        <div
          className="generationContextMenu"
          style={{ left: `${generationMenu.x}px`, top: `${generationMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {generationModeOptions.map((option) => {
            const isEnabled = canGenerateMode(option.id);

            return (
              <button
                className="generationContextMenuItem"
                key={option.id}
                type="button"
                disabled={!isEnabled}
                onClick={() => generateFromContextMenu(option.id)}
              >
                <svg
                  aria-hidden="true"
                  className="generationContextMenuPreview"
                  viewBox="0 0 40 34"
                  preserveAspectRatio="none"
                >
                  <polyline points={buildGenerationModePreviewPoints(option.id)} />
                </svg>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {segmentContextMenu ? (
        <div
          className="axisContextMenu"
          style={{ left: `${segmentContextMenu.x}px`, top: `${segmentContextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {segmentContextMenu.kind === "copy" ? (
            <button className="axisContextMenuItem" type="button" onClick={copyGeneratedSegmentFromContextMenu}>
              Copy
            </button>
          ) : (
            <button
              className="axisContextMenuItem"
              type="button"
              disabled={!copiedGeneratedSegmentPasteTarget}
              onClick={pasteGeneratedSegmentFromContextMenu}
            >
              Paste
            </button>
          )}
        </div>
      ) : null}
      {nodeRangeContextMenu ? (
        <div
          className="axisContextMenu"
          style={{ left: `${nodeRangeContextMenu.x}px`, top: `${nodeRangeContextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {nodeRangeContextMenu.kind === "copy" ? (
            <>
              <button className="axisContextMenuItem" type="button" onClick={cutNodeRangeFromContextMenu}>
                Cut
              </button>
              <button className="axisContextMenuItem" type="button" onClick={copyNodeRangeFromContextMenu}>
                Copy
              </button>
            </>
          ) : (
            <>
              {(["merge", "insert", "replace"] as const).map((mode) => (
                <button
                  key={mode}
                  className={
                    nodeRangePasteMode === mode ? "axisContextMenuItem active" : "axisContextMenuItem"
                  }
                  type="button"
                  onClick={() => setNodeRangePasteMode(mode)}
                >
                  {mode === "merge" ? "Merge" : mode === "insert" ? "Insert" : "Replace"}
                </button>
              ))}
              <button
                className="axisContextMenuItem"
                type="button"
                disabled={!copiedNodeRangePasteTarget}
                onClick={pasteNodeRangeFromContextMenu}
              >
                Paste
              </button>
            </>
          )}
        </div>
      ) : null}
      {axisContextMenu ? (
        <div
          className="axisContextMenu"
          style={{ left: `${axisContextMenu.x}px`, top: `${axisContextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {axisContextMenu.kind === "axis" ? (
            <>
              <button className="axisContextMenuItem" type="button" onClick={openAxisRenameDialog}>
                Rename
              </button>
              <button className="axisContextMenuItem" type="button" onClick={copyAxisFromContextMenu}>
                Copy
              </button>
            </>
          ) : (
            <button
              className="axisContextMenuItem"
              type="button"
              disabled={!copiedAxis}
              onClick={pasteAxisFromContextMenu}
            >
              Paste
            </button>
          )}
        </div>
      ) : null}
      {serverBrowser ? (
        <div className="saveGapDialogBackdrop" role="presentation" onClick={() => setServerBrowser(null)}>
          <div
            className="saveGapDialog serverBrowserDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="server-browser-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="saveGapDialogHeader">
              <span id="server-browser-title">Open from Server</span>
              <span>MOTION_DIR</span>
            </div>
            <div className="saveGapDialogBody serverBrowserBody">
              {serverBrowser.notice ? <div className="serverBrowserStatus">{serverBrowser.notice}</div> : null}
              {serverBrowser.loading ? (
                <div className="serverBrowserStatus">Loading…</div>
              ) : serverBrowser.error ? (
                <div className="serverBrowserStatus error">{serverBrowser.error}</div>
              ) : serverBrowser.files.length === 0 ? (
                <div className="serverBrowserStatus">No CSV files found in server folder.</div>
              ) : (
                <ul className="serverFileList">
                  {serverBrowser.files.map((entry) => (
                    <li key={entry.relativePath}>
                      <button
                        type="button"
                        className="serverFileItem"
                        onClick={() => void openServerFile(entry)}
                      >
                        <span className="serverFileName">{entry.name}</span>
                        <span className="serverFileMeta">
                          {(entry.size / 1024).toFixed(1)} KB
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="saveGapDialogFooter">
              <span />
              <div className="saveGapActions">
                <button
                  type="button"
                  title="서버 라이브러리 전체(csv+meta)를 zip 하나로 다운로드"
                  onClick={exportServerLibrary}
                  disabled={serverBrowser.files.length === 0}
                >
                  Export Library
                </button>
                <button
                  type="button"
                  title="Export Library로 받은 zip을 업로드해 라이브러리 복원 (동일 파일명 덮어씀)"
                  onClick={() => libraryImportInputRef.current?.click()}
                >
                  Import Library
                </button>
                <button type="button" onClick={() => void openServerBrowser()}>
                  Refresh
                </button>
                <button type="button" onClick={() => setServerBrowser(null)}>
                  Cancel
                </button>
              </div>
            </div>
            <input
              ref={libraryImportInputRef}
              className="hiddenInput"
              type="file"
              accept=".zip,application/zip"
              onChange={handleLibraryImportChange}
            />
          </div>
        </div>
      ) : null}
      {serverSaveAsDialog ? (
        <div className="saveGapDialogBackdrop" role="presentation">
          <form
            className="saveGapDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="server-save-as-title"
            onSubmit={(e) => { e.preventDefault(); void handleServerSaveAsConfirm(); }}
          >
            <div className="saveGapDialogHeader">
              <span id="server-save-as-title">Save to Server</span>
              <span>file name</span>
            </div>
            <div className="saveGapDialogBody">
              <label className="saveGapField">
                <span>File name (.csv)</span>
                <input
                  autoFocus
                  value={serverSaveAsDialog.name}
                  onChange={(e) =>
                    setServerSaveAsDialog((cur) => cur ? { ...cur, name: e.target.value } : cur)
                  }
                />
              </label>
            </div>
            <div className="saveGapDialogFooter">
              <span>Saved to server MOTION_DIR folder.</span>
              <div className="saveGapActions">
                <button type="button" onClick={() => setServerSaveAsDialog(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
