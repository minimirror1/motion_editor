"use client";

import { Maximize2, Redo2, Save, Search, Undo2, Upload } from "lucide-react";
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

type EditorSnapshot = {
  axes: MotionAxis[];
  currentFrame: number;
  error: string;
  fileName: string;
  generatedSegmentId: number;
  generatedSegments: GeneratedSegment[];
  nodeDegreeInput: string;
  nodeSelectionKind: NodeSelectionKind;
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
  | "linear"
  | "quadratic"
  | "quartic"
  | "quintic"
  | "sinusoidal";
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
};

type DragState = VisibleRange & {
  x: number;
  y: number;
  yMin: number;
  yMax: number;
};

type HorizontalResizeState = {
  x: number;
  width: number;
};

type VerticalResizeState = {
  y: number;
  height: number;
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
const FOCUS_FRAME_RADIUS = 100;
const FOCUS_DEGREE_RADIUS = 50;
const MAX_UNDO_HISTORY = 80;
const generationModeOptions: Array<{ id: GeneratedSegmentMode; label: string }> = [
  { id: "linear", label: "Linear" },
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
const MIN_AXIS_PANE_WIDTH = 172;
const DEFAULT_SIDE_PANE_WIDTH = 240;
const DEFAULT_CURRENT_FRAME = 10;
const DEFAULT_TIMELINE_MAX_FRAME = 119;
const DEFAULT_SPLINE_MIN_GAP = 2;
const DEFAULT_SPLINE_TENSION = 0;
const MAX_TIMELINE_FRAME = 100000;
const MOTION_FRAME_INTERVAL_SECONDS = 0.01;
const DEGREE_MATCH_TOLERANCE = 0.1;

const isMotionNumber = (value: MotionValue | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const framesToSeconds = (frames: number) => frames * MOTION_FRAME_INTERVAL_SECONDS;

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

const buildInterpolationRatio = (ratio: number, mode: SegmentInterpolationMode) => {
  if (mode === "bezier") {
    const inverseRatio = 1 - ratio;
    return 3 * inverseRatio * inverseRatio * ratio * 0.25 + 3 * inverseRatio * ratio * ratio * 0.75 + ratio ** 3;
  }

  if (mode === "circular") {
    return 1 - Math.sqrt(1 - ratio * ratio);
  }

  if (mode === "cubic") {
    return ratio * ratio * (3 - 2 * ratio);
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
  const nextSpan = clamp(span, minSpan, maxIndex);
  const nextStart = clamp(start, 0, maxIndex - nextSpan);

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

const clampFrameToVisibleRange = (frame: number, range: VisibleRange, maxIndex: number) => {
  const minVisibleFrame = Math.max(0, Math.ceil(range.start));
  const maxVisibleFrame = Math.min(maxIndex, Math.floor(range.end));

  if (maxVisibleFrame < minVisibleFrame) {
    return clamp(Math.round(range.start), 0, maxIndex);
  }

  return clamp(Math.round(frame), minVisibleFrame, maxVisibleFrame);
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

const formatStatDegree = (value: number | null) => (value === null ? "-" : `${formatStatNumber(value)} deg`);

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
  const ratio = clamp((frame - startFrame) / frameSpan, 0, 1);
  const startLength = clamp(startHandle.rightLength, 0.1, frameSpan * 0.48);
  const endLength = clamp(endHandle.leftLength, 0.1, frameSpan * 0.48);
  const startControlValue = startValue + handleAngleToSlope(startHandle.angle) * framesToSeconds(startLength);
  const endControlValue = endValue - handleAngleToSlope(endHandle.angle) * framesToSeconds(endLength);

  return cubicBezierPoint(startValue, startControlValue, endControlValue, endValue, ratio);
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

export function MotionEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const axisResizeRef = useRef<HorizontalResizeState | null>(null);
  const rightResizeRef = useRef<HorizontalResizeState | null>(null);
  const rightSplitResizeRef = useRef<VerticalResizeState | null>(null);
  const bottomResizeRef = useRef<VerticalResizeState | null>(null);
  const plotSurfaceRef = useRef<HTMLDivElement>(null);
  const playheadDragRef = useRef(false);
  const boxSelectRef = useRef<BoxSelectState | null>(null);
  const nodeValueDragRef = useRef<NodeValueDragState | null>(null);
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
  const [yRange, setYRange] = useState<DegreeRange>({ min: -90, max: 90 });
  const [axisPaneWidth, setAxisPaneWidth] = useState(DEFAULT_SIDE_PANE_WIDTH);
  const [rightPaneWidth, setRightPaneWidth] = useState(DEFAULT_SIDE_PANE_WIDTH);
  const [rightHandlePaneHeight, setRightHandlePaneHeight] = useState<number | null>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState(440);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizingAxis, setIsResizingAxis] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingRightSplit, setIsResizingRightSplit] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
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
  const [saveGapDialog, setSaveGapDialog] = useState<SaveGapDialogState | null>(null);
  const [saveGapMode, setSaveGapMode] = useState<MissingValueSaveStrategy>("linear");
  const [nodeDegreeInput, setNodeDegreeInput] = useState("0");
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const createEditorSnapshot = (): EditorSnapshot => ({
    axes: cloneMotionAxes(axes),
    currentFrame,
    error,
    fileName,
    generatedSegmentId: generatedSegmentIdRef.current,
    generatedSegments: cloneGeneratedSegments(generatedSegments),
    nodeDegreeInput,
    nodeSelectionKind,
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
    setYRange({ ...snapshot.yRange });
    setNodeDegreeInput(snapshot.nodeDegreeInput);
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
  const rightPaneGridRows =
    rightHandlePaneHeight === null
      ? "minmax(0, 1fr) 8px minmax(0, 1fr)"
      : `minmax(0, 1fr) 8px ${rightHandlePaneHeight}px`;
  const displayedCurrentFrame = clampFrameToVisibleRange(currentFrame, visibleRange, timelineMaxIndex);
  const playheadPosition = clamp(((displayedCurrentFrame - visibleRange.start) / visibleFrameSpan) * 100, 0, 100);
  const isPlayheadVisible =
    displayedCurrentFrame >= visibleRange.start && displayedCurrentFrame <= visibleRange.end;
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
  const axisInfoRows = useMemo(() => {
    if (!selectedAxisStats) return [];

    return [
      [
        "Axis",
        selectedAxisStats.name ?? formatStatNumber(selectedAxisStats.index),
      ],
      ["Nodes", formatStatNumber(selectedAxisStats.nodeCount)],
      ["Max", formatStatDegree(selectedAxisStats.maxValue)],
      ["Min", formatStatDegree(selectedAxisStats.minValue)],
    ];
  }, [selectedAxisStats]);
  const selectedFrameValue =
    selectedAxisRecord && isMotionNumber(selectedAxisRecord.values[displayedCurrentFrame])
      ? selectedAxisRecord.values[displayedCurrentFrame]
      : null;
  const selectedNodeValue =
    selectedAxisRecord &&
    selectedNode?.axisIndex === selectedAxisRecord.index &&
    isMotionNumber(selectedAxisRecord.values[selectedNode.frame])
      ? selectedAxisRecord.values[selectedNode.frame]
      : null;
  const selectedAxisDisplayName = formatAxisDisplayName(selectedAxisRecord);
  const hasFocusSelectedNode = selectedNodeValue !== null && selectedNode?.axisIndex === selectedAxisRecord?.index;
  const focusTargetFrame = hasFocusSelectedNode && selectedNode ? selectedNode.frame : displayedCurrentFrame;
  const focusTargetValue = hasFocusSelectedNode ? selectedNodeValue : selectedFrameValue ?? (selectedAxisRecord ? 0 : null);
  const selectedAxisNodeSelection = selectedNodes.filter((node) => node.axisIndex === selectedAxisRecord?.index);
  const activeSelectedNodes =
    selectedAxisRecord && selectedAxisNodeSelection.length > 0
      ? selectedAxisNodeSelection
      : selectedAxisRecord && selectedNode?.axisIndex === selectedAxisRecord.index
        ? [selectedNode]
        : [];
  const selectedFrameRange =
    activeSelectedNodes.length > 0
      ? {
          start: Math.min(...activeSelectedNodes.map((node) => node.frame)),
          end: Math.max(...activeSelectedNodes.map((node) => node.frame)),
        }
      : null;
  const activeGeneratedSegments = useMemo(
    () => [...generatedSegments].sort((left, right) => left.id - right.id),
    [generatedSegments],
  );
  const generatedSegmentRows = useMemo(() => {
    const rows = new Map<number, GeneratedSegment[]>();

    activeGeneratedSegments.forEach((segment) => {
      rows.set(segment.axisIndex, [...(rows.get(segment.axisIndex) ?? []), segment]);
    });

    return [...rows.entries()]
      .sort(([leftAxis], [rightAxis]) => leftAxis - rightAxis)
      .map(([axisIndex, segments]) => ({ axisIndex, segments }));
  }, [activeGeneratedSegments]);
  const selectedGeneratedSegment = useMemo(
    () => generatedSegments.find((segment) => generatedSegmentKey(segment) === selectedGeneratedSegmentKey) ?? null,
    [generatedSegments, selectedGeneratedSegmentKey],
  );
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
  const copiedNodeRangePasteTarget = (() => {
    const targetNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;

    if (!copiedNodeRange || !selectedAxisRecord || !targetNode) return null;
    if (targetNode.axisIndex !== selectedAxisRecord.index) return null;

    const startValue = selectedAxisRecord.values[targetNode.frame];
    if (!isMotionNumber(startValue)) return null;

    const endFrame = targetNode.frame + copiedNodeRange.duration;
    const lastFrame = getLastMotionValueFrame(selectedAxisRecord.values);
    const hasRightSpace =
      lastFrame === targetNode.frame ||
      copiedNodeRange.nodes.every(({ offset }) => {
        const frame = targetNode.frame + offset;

        return offset === 0 || !isMotionNumber(selectedAxisRecord.values[frame]);
      });

    if (!hasRightSpace) return null;

    return {
      axis: selectedAxisRecord,
      endFrame,
      startFrame: targetNode.frame,
      startValue,
    };
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
      selectedGeneratedSegment.mode === "linear"
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

      const slope = handleAngleToSlope(handle.angle);
      const leftFrame = frame - handle.leftLength;
      const rightFrame = frame + handle.rightLength;
      const leftValue = value - slope * framesToSeconds(handle.leftLength);
      const rightValue = value + slope * framesToSeconds(handle.rightLength);

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
  const nodeInfoRows =
    !selectedAxisRecord || activeSelectedNodes.length === 0
      ? []
      : activeSelectedNodes.length > 1
        ? [
            ["Axis", selectedAxisDisplayName],
            ["Selected", formatStatNumber(activeSelectedNodes.length)],
            ["Start Index", formatStatNumber(selectedFrameRange?.start ?? null)],
            ["End Index", formatStatNumber(selectedFrameRange?.end ?? null)],
          ]
        : [
            ["Axis", selectedAxisDisplayName],
            ["Index", formatStatNumber(activeSelectedNodes[0].frame)],
            [
              "Degree",
              formatStatDegree(
                isMotionNumber(selectedAxisRecord.values[activeSelectedNodes[0].frame])
                  ? selectedAxisRecord.values[activeSelectedNodes[0].frame]
                  : null,
              ),
            ],
            ["Selected", "1"],
          ];

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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsedAxes = parseMotionCsv(text);
    const nextFrameCount = parsedAxes.reduce((max, axis) => Math.max(max, axis.values.length), 0);
    const nextMaxFrame = Math.max(0, nextFrameCount - 1);

    pushUndoSnapshot();

    setFileName(file.name);
    setAxes(parsedAxes);
    setGeneratedSegments([]);
    generatedSegmentIdRef.current = 0;
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
    event.target.value = "";
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
      setSaveGapDialog(gapStats);
      return;
    }

    setSaveGapDialog(null);

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

  const handleNodeDegreeInputChange = (value: string) => {
    setNodeDegreeInput(value);

    const nextValue = Number(value);
    const targetNode = activeSelectedNodes.length === 1 ? activeSelectedNodes[0] : null;

    if (
      value.trim().length === 0 ||
      !Number.isFinite(nextValue) ||
      !selectedAxisRecord ||
      !targetNode ||
      targetNode.axisIndex !== selectedAxisRecord.index
    ) {
      return;
    }

    pushUndoSnapshot();
    updateNodeValue(targetNode.axisIndex, targetNode.frame, nextValue);
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
    setCurrentFrame((current) =>
      clampFrameToVisibleRange(
        current,
        nextRange,
        Math.max(DEFAULT_TIMELINE_MAX_FRAME, maxFrameIndex, current, Math.ceil(nextRange.end)),
      ),
    );
  };

  const fitGraph = () => {
    applyVisibleRange(frameCount > 1 ? { start: 0, end: maxFrameIndex } : { start: 0, end: DEFAULT_TIMELINE_MAX_FRAME });
    setYRange(buildDataYRange(axes));
  };

  const focusSelectedAxisAtPlayhead = () => {
    if (!selectedAxisRecord || focusTargetValue === null) return;

    const frame = focusTargetFrame;
    const nextRange = clampRange(
      frame - FOCUS_FRAME_RADIUS,
      FOCUS_FRAME_RADIUS * 2,
      Math.max(timelineMaxIndex, frame + FOCUS_FRAME_RADIUS),
    );

    applyVisibleRange(nextRange);
    setCurrentFrame(frame);
    if (hasFocusSelectedNode) {
      setSelectedNode({ axisIndex: selectedAxisRecord.index, frame });
      setSelectedNodes([{ axisIndex: selectedAxisRecord.index, frame }]);
      setNodeSelectionKind("single");
      syncNodeDegreeInput(selectedAxisRecord.values[frame]);
    } else {
      setSelectedNode(null);
      setSelectedNodes([]);
      setNodeSelectionKind(null);
    }
    setYRange({ min: focusTargetValue - FOCUS_DEGREE_RADIUS, max: focusTargetValue + FOCUS_DEGREE_RADIUS });
  };

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
    const ratio = (clientX - rect.left) / rect.width;
    const span = visibleRange.end - visibleRange.start;
    const nextFrame = clamp(Math.round(visibleRange.start + span * ratio), 0, MAX_TIMELINE_FRAME);
    let nextRange = visibleRange;

    if (nextFrame < visibleRange.start) {
      nextRange = clampFreeRange(Math.max(0, nextFrame), span);
    } else if (nextFrame > visibleRange.end) {
      nextRange = clampFreeRange(Math.max(0, nextFrame - span), span);
    }

    const nextCurrentFrame = clampFrameToVisibleRange(
      nextFrame,
      nextRange,
      Math.max(timelineMaxIndex, nextFrame, Math.ceil(nextRange.end)),
    );
    const nextSelectedNode =
      selectedAxisRecord && isMotionNumber(selectedAxisRecord.values[nextCurrentFrame])
        ? {
            axisIndex: selectedAxisRecord.index,
            frame: nextCurrentFrame,
          }
        : null;

    setVisibleRange(nextRange);
    setCurrentFrame(nextCurrentFrame);
    setSelectedNode(nextSelectedNode);
    setSelectedNodes(nextSelectedNode ? [nextSelectedNode] : []);
    setNodeSelectionKind(nextSelectedNode ? "single" : null);
    setSelectedGeneratedSegmentKey(null);
    setSelectedGeneratedHandle(null);
    if (nextSelectedNode) {
      syncNodeDegreeInput(selectedAxisRecord?.values[nextCurrentFrame]);
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

    if (copiedNodeRangePasteTarget) {
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

  const pasteNodeRangeFromContextMenu = () => {
    if (!copiedNodeRange || !copiedNodeRangePasteTarget) return;

    const { axis, endFrame, startFrame, startValue } = copiedNodeRangePasteTarget;
    const nextValues = [...axis.values];

    while (nextValues.length <= endFrame) {
      nextValues.push(null);
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
      current.filter(
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

    updateGeneratedHandle(selectedGeneratedHandle.segmentId, selectedGeneratedHandle.frame, (handle) => ({
      ...handle,
      [field]: field === "angle" ? nextValue : Math.max(0.1, nextValue),
    }));
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

    const centerValue = selectedAxisRecord.values[frame];
    if (!isMotionNumber(centerValue)) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pushUndoSnapshot();
    generatedHandleDragRef.current = {
      centerFrame: frame,
      centerValue,
      frame,
      segmentId: selectedGeneratedSegment.id,
      side,
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

    updateGeneratedHandle(drag.segmentId, drag.frame, (handle) => ({
      ...handle,
      angle,
      [drag.side === "right" ? "rightLength" : "leftLength"]: length,
    }));
  };

  const handleGeneratedHandlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    generatedHandleDragRef.current = null;
    setIsDraggingGeneratedHandle(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2) {
      setGenerationMenu(null);
      setSegmentContextMenu(null);
      setNodeRangeContextMenu(null);
    }

    if (
      event.button === 2 &&
      !copiedNodeRangePasteTarget &&
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
      pushUndoSnapshot();

      const rect = event.currentTarget.getBoundingClientRect();
      nodeValueDragRef.current = {
        axisIndex: targetNode.axisIndex,
        frame: targetNode.frame,
        startValue: targetValue,
        startY: event.clientY,
        degreesPerPixel: Math.max(yRange.max - yRange.min, 0.0001) / rect.height,
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
    const nodeValueDrag = nodeValueDragRef.current;
    if (nodeValueDrag) {
      event.preventDefault();
      const nextValue = nodeValueDrag.startValue - (event.clientY - nodeValueDrag.startY) * nodeValueDrag.degreesPerPixel;

      updateNodeValue(nodeValueDrag.axisIndex, nodeValueDrag.frame, nextValue);
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
    const deltaDegrees = (event.clientY - drag.y) * (ySpan / rect.height);

    const framesPerPixel = xSpan / rect.width;
    const deltaFrames = (event.clientX - drag.x) * framesPerPixel;
    const nextStart = drag.start - deltaFrames;
    applyVisibleRange(
      frameCount > 1 ? clampRange(nextStart, xSpan, timelineMaxIndex) : clampFreeRange(nextStart, xSpan),
    );

    setYRange({
      min: drag.yMin + deltaDegrees,
      max: drag.yMax + deltaDegrees,
    });
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
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

  const handleAxisResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    axisResizeRef.current = {
      x: event.clientX,
      width: axisPaneWidth,
    };
    setIsResizingAxis(true);
  };

  const handleAxisResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    const resize = axisResizeRef.current;
    if (!resize) return;

    const maxWidth = Math.max(MIN_AXIS_PANE_WIDTH, window.innerWidth - rightPaneWidth - 320);
    setAxisPaneWidth(clamp(resize.width + event.clientX - resize.x, MIN_AXIS_PANE_WIDTH, maxWidth));
  };

  const handleAxisResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    axisResizeRef.current = null;
    setIsResizingAxis(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleRightResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rightResizeRef.current = {
      x: event.clientX,
      width: rightPaneWidth,
    };
    setIsResizingRight(true);
  };

  const handleRightResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    const resize = rightResizeRef.current;
    if (!resize) return;

    const maxWidth = Math.max(MIN_AXIS_PANE_WIDTH, window.innerWidth - axisPaneWidth - 320);
    setRightPaneWidth(clamp(resize.width - (event.clientX - resize.x), MIN_AXIS_PANE_WIDTH, maxWidth));
  };

  const handleRightResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    rightResizeRef.current = null;
    setIsResizingRight(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleRightSplitResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const handlePane = event.currentTarget.nextElementSibling;
    const handlePaneHeight =
      handlePane instanceof HTMLElement
        ? handlePane.getBoundingClientRect().height
        : rightHandlePaneHeight ?? 220;
    rightSplitResizeRef.current = {
      y: event.clientY,
      height: handlePaneHeight,
    };
    setIsResizingRightSplit(true);
  };

  const handleRightSplitResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    const resize = rightSplitResizeRef.current;
    if (!resize) return;

    const paneHeight = event.currentTarget.parentElement?.getBoundingClientRect().height ?? window.innerHeight;
    const maxHeight = Math.max(140, paneHeight - 170);
    setRightHandlePaneHeight(clamp(resize.height - (event.clientY - resize.y), 120, maxHeight));
  };

  const handleRightSplitResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    rightSplitResizeRef.current = null;
    setIsResizingRightSplit(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleBottomResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bottomResizeRef.current = {
      y: event.clientY,
      height: bottomDockHeight,
    };
    setIsResizingBottom(true);
  };

  const handleBottomResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    const resize = bottomResizeRef.current;
    if (!resize) return;

    const maxHeight = Math.max(100, window.innerHeight - 180);
    setBottomDockHeight(clamp(resize.height - (event.clientY - resize.y), 80, maxHeight));
  };

  const handleBottomResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    bottomResizeRef.current = null;
    setIsResizingBottom(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <main className="graphStage">
      <section className="graphEditor" aria-label="Motion graph editor">
        <div className="editorToolbar">
          <span className={error ? "fileMeta error" : "fileMeta"}>
            {error || (fileName ? `${fileName} · ${axes.length} axes · ${frameCount} frames` : "no file")}
          </span>
          <div className="toolbarActions">
            <button className="loadButton" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              CSV
            </button>
            <button className="loadButton" type="button" onClick={() => void saveMotionCsv()} disabled={axes.length === 0}>
              <Save size={14} />
              Save
            </button>
            <input
              ref={fileInputRef}
              className="hiddenInput"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div
          className={isResizingAxis || isResizingRight || isResizingRightSplit ? "editorBody resizing" : "editorBody"}
          style={{ gridTemplateColumns: `${axisPaneWidth}px minmax(0, 1fr) ${rightPaneWidth}px` }}
        >
          <aside className="axisPane">
            <div
              className={isResizingAxis ? "axisResizeHandle active" : "axisResizeHandle"}
              onPointerDown={handleAxisResizeDown}
              onPointerMove={handleAxisResizeMove}
              onPointerUp={handleAxisResizeEnd}
              onPointerCancel={handleAxisResizeEnd}
            />
            <div className="axisPaneHeader">
              <button type="button" onClick={addAxis}>
                New
              </button>
              <button type="button" onClick={deleteSelectedAxis} disabled={selectedAxis === null}>
                Delete
              </button>
              <button type="button" onClick={cutSelectedAxisAtPlayhead} disabled={!canCutSelectedAxis}>
                Cut
              </button>
            </div>
            <div className="axisList" onContextMenu={handleAxisListContextMenu}>
              {axes.map((axis) => (
                <button
                  className={selectedAxis === axis.index ? "axisIndexRow selected" : "axisIndexRow"}
                  key={axis.index}
                  type="button"
                  title={formatAxisDisplayName(axis)}
                  onClick={() => selectAxis(axis.index)}
                  onContextMenu={(event) => handleAxisRowContextMenu(event, axis.index)}
                >
                  {formatAxisDisplayName(axis)}
                </button>
              ))}
            </div>
            <div className="axisInfoPane">
              <div className="axisInfoPaneHeader">
                <span>Axis Info</span>
                <span>{selectedAxisStats ? selectedAxisDisplayName : "no axis"}</span>
              </div>
              <div className="axisInfoPaneBody">
                {selectedAxisStats ? (
                  <table className="axisInfoTable">
                    <tbody>
                      {axisInfoRows.map((row) => (
                        <tr key={row[0]}>
                          <th title={row[0]}>{row[0]}</th>
                          <td title={row[1]}>{row[1]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="emptyAxisInfo">No axis selected</div>
                )}
              </div>
            </div>
          </aside>

          <section
            className={isResizingBottom ? "curvePane resizing" : "curvePane"}
            style={{ gridTemplateRows: `36px minmax(0, 1fr) ${bottomDockHeight}px` }}
          >
            <div className="frameRuler">
              <span className="axisUnit" aria-hidden="true" />
              <div className="frameTicks" onWheel={handleWheel}>
                {frameMarks.map((mark) => (
                  <span key={`${mark.frame}-${mark.x}`} style={{ left: `${mark.x}%` }}>
                    {formatFrameTime(mark.frame)}
                  </span>
                ))}
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
            </div>

            <div
              className="curveViewport"
            >
              <div className="yRuler" onWheel={handleYWheel}>
                {yMarks.map((mark) => (
                  <span key={mark.value} style={{ top: `${mark.y}%` }}>
                    {formatDegree(mark.value)}
                  </span>
                ))}
                <span className="yAxisUnit">deg</span>
              </div>

              <div
                className={
                  isDraggingNodeValue
                    ? "plotSurface editingNodeValue"
                      : isPanning
                        ? "plotSurface panning"
                        : isDraggingGeneratedHandle
                          ? "plotSurface editingHandle"
                          : "plotSurface"
                }
                ref={plotSurfaceRef}
                onContextMenu={handlePlotContextMenu}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <button
                  className="focusGraphButton"
                  type="button"
                  title="Focus selected axis at current frame"
                  disabled={!selectedAxisRecord}
                  onClick={(event) => {
                    event.stopPropagation();
                    focusSelectedAxisAtPlayhead();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Search size={17} />
                </button>
                <button
                  className="undoGraphButton"
                  type="button"
                  title="Undo last edit"
                  disabled={undoDepth === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    undoLastEdit();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="redoGraphButton"
                  type="button"
                  title="Redo last edit"
                  disabled={redoDepth === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    redoLastEdit();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Redo2 size={17} />
                </button>
                <button
                  className="fitGraphButton"
                  type="button"
                  title="Fit graph"
                  onClick={(event) => {
                    event.stopPropagation();
                    fitGraph();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Maximize2 size={18} />
                </button>
                <svg className="curveSvg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
                  {frameMarks.map((mark) => (
                    <line key={`frame-${mark.x}`} x1={mark.x} x2={mark.x} y1="0" y2="100" className="gridLine vertical" />
                  ))}
                  {yMarks.map((mark) => (
                    <line key={`degree-${mark.value}`} x1="0" x2="100" y1={mark.y} y2={mark.y} className="gridLine" />
                  ))}
                  <line
                    x1="0"
                    x2="100"
                    y1={92 - ((0 - yRange.min) / Math.max(yRange.max - yRange.min, 1)) * 84}
                    y2={92 - ((0 - yRange.min) / Math.max(yRange.max - yRange.min, 1)) * 84}
                    className="zeroLine"
                  />

                  {renderedAxes.map((axis) => {
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
                </svg>
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
                  {selectedAxis !== null
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
                              onPointerDown={(event) => {
                                if (event.button === 0) {
                                  event.stopPropagation();
                                }
                              }}
                            />
                          </Fragment>
                        );
                      })
                    : null}
                </div>
              </div>
            </div>

            <div className="bottomDock" aria-label="Bottom panel">
              <div
                className={isResizingBottom ? "bottomResizeHandle active" : "bottomResizeHandle"}
                onPointerDown={handleBottomResizeDown}
                onPointerMove={handleBottomResizeMove}
                onPointerUp={handleBottomResizeEnd}
                onPointerCancel={handleBottomResizeEnd}
              />
              <div className="bottomDockBody">
                <div className="generatedSegmentList" aria-label="Generated segments">
                  {activeGeneratedSegments.length === 0 ? (
                    <div className="emptyGeneratedSegments">No generated segments</div>
                  ) : null}
                  {generatedSegmentRows.map((row) => (
                    <div className="generatedSegmentAxisRow" key={row.axisIndex}>
                      <div className="generatedSegmentAxisLabel">
                        Axis {formatAxisDisplayName(axes.find((axis) => axis.index === row.axisIndex))}
                      </div>
                      <div className="generatedSegmentAxisCards">
                        {row.segments.map((segment) => {
                          const segmentKey = generatedSegmentKey(segment);
                          const segmentAxis = axes.find((axis) => axis.index === segment.axisIndex);
                          const previewPoints = segmentAxis
                            ? toGeneratedSegmentPreviewPoints(segmentAxis.values, segment)
                            : [];
                          const isSelectedSegment = selectedGeneratedSegmentKey === segmentKey;
                          const segmentColor = isSelectedSegment
                            ? SELECTED_GENERATED_SEGMENT_COLOR
                            : GENERATED_SEGMENT_COLOR;

                          return (
                            <button
                              className={isSelectedSegment ? "generatedSegmentCard selected" : "generatedSegmentCard"}
                              key={segmentKey}
                              type="button"
                              onClick={() => selectGeneratedSegment(segment)}
                              onContextMenu={(event) => handleGeneratedSegmentContextMenu(event, segment)}
                            >
                              <span className="generatedSegmentCardHeader">
                                <span className="generatedSegmentSwatch" style={{ background: segmentColor }} />
                                <span className="generatedSegmentMode">{generatedSegmentLabels[segment.mode]}</span>
                                <span className="generatedSegmentAxis">Axis {formatAxisDisplayName(segmentAxis)}</span>
                              </span>
                              <svg
                                aria-hidden="true"
                                className="generatedSegmentPreview"
                                viewBox="0 0 100 64"
                                preserveAspectRatio="none"
                              >
                                <line x1="0" x2="100" y1="32" y2="32" className="generatedSegmentPreviewZero" />
                                {previewPoints.length > 1 ? (
                                  <polyline
                                    className="generatedSegmentPreviewCurve"
                                    points={toPolyline(previewPoints)}
                                    style={{ stroke: segmentColor }}
                                  />
                                ) : null}
                              </svg>
                              <span className="generatedSegmentCardMeta">
                                <span>
                                  {segment.startFrame} - {segment.endFrame}
                                </span>
                                <span>
                                  {formatFrameTime(segment.startFrame)} - {formatFrameTime(segment.endFrame)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <aside
            className="rightPane"
            aria-label="Right panel"
            style={{ gridTemplateRows: rightPaneGridRows }}
          >
            <div
              className={isResizingRight ? "rightResizeHandle active" : "rightResizeHandle"}
              onPointerDown={handleRightResizeDown}
              onPointerMove={handleRightResizeMove}
              onPointerUp={handleRightResizeEnd}
              onPointerCancel={handleRightResizeEnd}
            />
            <section className="rightNodePanel" aria-label="Node controls">
              <div className="rightPaneHeader">
                <button type="button" onClick={addNodeToSelectedAxis} disabled={!canAddNode}>
                  Add
                </button>
                <button type="button" onClick={deleteSelectedNodes} disabled={!canDeleteNode}>
                  Remove
                </button>
                <button type="button" onClick={shiftSelectedNodeToLeft} disabled={!canShiftNode}>
                  Shift
                </button>
              </div>
              <div className="rightPaneBody">
                <label className="nodeDegreeField">
                  <span>Degree</span>
                  <input
                    type="number"
                    step="0.1"
                    value={nodeDegreeInput}
                    disabled={!selectedAxisRecord}
                    onChange={(event) => handleNodeDegreeInputChange(event.target.value)}
                  />
                  <span>deg</span>
                </label>
              </div>
              <div className="nodeInfoPane">
                <div className="nodeInfoPaneHeader">
                  <span>Node Info</span>
                  <span>
                    {activeSelectedNodes.length > 1
                      ? `${activeSelectedNodes.length} selected`
                      : activeSelectedNodes.length === 1
                        ? `index ${activeSelectedNodes[0].frame}`
                        : "no node"}
                  </span>
                </div>
                <div className="nodeInfoPaneBody">
                  {nodeInfoRows.length > 0 ? (
                    <table className="nodeInfoTable">
                      <tbody>
                        {nodeInfoRows.map((row) => (
                          <tr key={row[0]}>
                            <th title={row[0]}>{row[0]}</th>
                            <td title={row[1]}>{row[1]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="emptyNodeInfo">No node selected</div>
                  )}
                </div>
              </div>
            </section>
            <div
              className={isResizingRightSplit ? "rightSplitResizeHandle active" : "rightSplitResizeHandle"}
              onPointerDown={handleRightSplitResizeDown}
              onPointerMove={handleRightSplitResizeMove}
              onPointerUp={handleRightSplitResizeEnd}
              onPointerCancel={handleRightSplitResizeEnd}
            />
            <section className="handleInfoPane" aria-label="Handle controls">
              <div className="handleInfoPaneHeader">
                <span>Handle Info</span>
                <span>
                  {selectedGeneratedHandle && selectedGeneratedHandleSegment
                    ? `index ${selectedGeneratedHandle.frame}`
                    : "no handle"}
                </span>
              </div>
              <div className="handleInfoPaneBody">
                {selectedGeneratedHandle && selectedGeneratedHandlePosition ? (
                  <div className="handleEditor">
                    <label className="handleField">
                      <span>Angle</span>
                      <input
                        type="number"
                        step="0.1"
                        value={formatStatNumber(selectedGeneratedHandlePosition.angle)}
                        onChange={(event) => updateSelectedGeneratedHandleField("angle", event.target.value)}
                      />
                      <span>deg</span>
                    </label>
                    <label className="handleField">
                      <span>Left Length</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={formatStatNumber(selectedGeneratedHandlePosition.leftLength)}
                        onChange={(event) => updateSelectedGeneratedHandleField("leftLength", event.target.value)}
                      />
                      <span>idx</span>
                    </label>
                    <label className="handleField">
                      <span>Right Length</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={formatStatNumber(selectedGeneratedHandlePosition.rightLength)}
                        onChange={(event) => updateSelectedGeneratedHandleField("rightLength", event.target.value)}
                      />
                      <span>idx</span>
                    </label>
                  </div>
                ) : (
                  <div className="emptyHandleInfo">No handle selected</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
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
                <button type="button" className="primary" onClick={() => void saveMotionCsv(saveGapMode, true)}>
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
            <button className="axisContextMenuItem" type="button" onClick={copyNodeRangeFromContextMenu}>
              Copy
            </button>
          ) : (
            <button
              className="axisContextMenuItem"
              type="button"
              disabled={!copiedNodeRangePasteTarget}
              onClick={pasteNodeRangeFromContextMenu}
            >
              Paste
            </button>
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
    </main>
  );
}
