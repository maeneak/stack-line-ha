import {
  StackLineCardConfig,
  StatType,
  PeriodType,
  ActionType,
  ActionConfig,
  GridOptions,
  FilterOperator,
} from "./types";

export const DEFAULT_GRID_OPTIONS: GridOptions = {
  columns: 6,
  rows: 4,
  min_columns: 3,
  max_columns: 12,
  min_rows: 2,
  max_rows: 8,
};

export const DEFAULT_TAP_ACTION: ActionConfig = {
  action: "none",
};

export const DEFAULT_HOLD_ACTION: ActionConfig = {
  action: "none",
};

export const DEFAULT_DOUBLE_TAP_ACTION: ActionConfig = {
  action: "none",
};

export const DEFAULT_CONFIG: Omit<StackLineCardConfig, "type" | "entities"> = {
  hours_to_show: 24,
  period: "hour",
  stacked: false,
  chart_type: "line",
  show_legend: true,
  show_points: false,
  normalize: false,
  tap_action: DEFAULT_TAP_ACTION,
  hold_action: DEFAULT_HOLD_ACTION,
  double_tap_action: DEFAULT_DOUBLE_TAP_ACTION,
  grid_options: DEFAULT_GRID_OPTIONS,
};

export const COLOR_PALETTE = [
  "#4fc3f7", // light blue
  "#ff8a65", // deep orange
  "#81c784", // green
  "#ba68c8", // purple
  "#fff176", // yellow
  "#f06292", // pink
  "#4dd0e1", // cyan
  "#a1887f", // brown
  "#90a4ae", // blue grey
  "#aed581", // light green
];

export const STAT_LABELS: Record<StatType, string> = {
  min: "Minimum",
  max: "Maximum",
  mean: "Mean (Average)",
  sum: "Sum (Total)",
  state: "State",
  change: "Change (Delta)",
};

export const PERIOD_LABELS: Record<PeriodType, string> = {
  "5minute": "5 Minutes",
  hour: "Hourly",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  none: "No action",
  "more-info": "More info",
  toggle: "Toggle",
  navigate: "Navigate",
  url: "Open URL",
  "perform-action": "Perform action",
  assist: "Assist",
};

export const FETCH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export const HOLD_THRESHOLD_MS = 500;
export const DOUBLE_TAP_THRESHOLD_MS = 250;

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: "Greater than",
  lt: "Less than",
  gte: "Greater or equal",
  lte: "Less or equal",
  eq: "Equal to",
  neq: "Not equal to",
};
