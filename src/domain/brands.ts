declare const brandSymbol: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

declare const gateSymbol: unique symbol;
export interface FactoryGate {
  readonly [gateSymbol]: true;
}

export type SnapshotKind = "baseline" | "run" | "design";
export type SnapshotSource = "implementation" | "figma" | "pen";

export interface SnapshotData {
  componentId: string;
  cellKey: string;
  kind: SnapshotKind;
  source: SnapshotSource;
  png: Uint8Array;
  width: number;
  height: number;
  scale: number;
  contentHash: string;
}
export type ValidatedSnapshot = Brand<SnapshotData, "ValidatedSnapshot">;

export type TokenType = "color" | "number" | "string" | "boolean";
export type TokenValue = string | number | boolean;

export interface DesignTokenData {
  source: "figma" | "pen" | "dtcg";
  name: string;
  type: TokenType;
  collection: string;
  values: Record<string, TokenValue>;
}
export type ValidatedDesignToken = Brand<DesignTokenData, "ValidatedDesignToken">;

export interface ComponentSpecData {
  id: string;
  title: string;
  filePath: string;
  axes: Record<string, readonly string[]>;
  defaultArgs: Record<string, unknown>;
}
export type ValidatedComponentSpec = Brand<ComponentSpecData, "ValidatedComponentSpec">;

export interface DiffBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VrtResultData {
  cellKey: string;
  changed: boolean;
  diffRatio: number;
  bounds: DiffBounds | null;
}
export type ValidatedVrtResult = Brand<VrtResultData, "ValidatedVrtResult">;

export interface VrtRunData {
  id: string;
  totalCells: number;
  changedCells: number;
  results: readonly ValidatedVrtResult[];
}
export type ValidatedVrtRun = Brand<VrtRunData, "ValidatedVrtRun">;

export type MarkSeverity = "info" | "warning" | "error";

export interface FigmaLinkData {
  componentId: string;
  fileKey: string;
  nodeId: string;
  r2Key: string;
}
export type ValidatedFigmaLink = Brand<FigmaLinkData, "ValidatedFigmaLink">;

export interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

export interface ASTPatchData {
  filePath: string;
  baseHash: string;
  afterHash: string;
  edits: readonly SourceEdit[];
}
export type ValidatedASTPatch = Brand<ASTPatchData, "ValidatedASTPatch">;

export interface SourceFileData {
  filePath: string;
  content: string;
  hash: string;
}
export type ValidatedSourceFile = Brand<SourceFileData, "ValidatedSourceFile">;

export interface PRRequestData {
  branch: string;
  title: string;
  body: string;
  patches: readonly ValidatedASTPatch[];
}
export type ValidatedPRRequest = Brand<PRRequestData, "ValidatedPRRequest">;

export interface AuditMarkData {
  cellKey: string;
  targetElementId: string | null;
  kind: "pin" | "note";
  text: string;
  severity: MarkSeverity;
  author: "ai" | "human";
  runId: string | null;
}
export type ValidatedAuditMark = Brand<AuditMarkData, "ValidatedAuditMark">;
