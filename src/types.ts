export type StatType = "min" | "max" | "mean" | "sum" | "state" | "change";

export type PeriodType = "5minute" | "hour" | "day" | "week" | "month";

export type ChartType = "line" | "area";

// ── Actions ───────────────────────────────────────────────────

export type ActionType =
  | "more-info"
  | "toggle"
  | "navigate"
  | "url"
  | "perform-action"
  | "assist"
  | "none";

export interface ActionConfig {
  action: ActionType;
  entity?: string;
  navigation_path?: string;
  url_path?: string;
  perform_action?: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  confirmation?: {
    text?: string;
  };
}

// ── Grid Options ──────────────────────────────────────────────

export interface GridOptions {
  columns: number;
  rows: number;
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

// ── Entity Config ─────────────────────────────────────────────

export interface EntityConfig {
  entity: string;
  stat: StatType;
  name?: string;
  color?: string;
  fill?: boolean;
  opacity?: number;
}

// ── Card Config ───────────────────────────────────────────────

export interface StackLineCardConfig {
  type: string;
  title?: string;
  hours_to_show: number;
  period: PeriodType;
  stacked: boolean;
  chart_type: ChartType;
  show_legend: boolean;
  show_points: boolean;
  entities: EntityConfig[];
  // Actions
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  // Grid layout
  grid_options?: GridOptions;
}

// ── Statistics ────────────────────────────────────────────────

export interface StatisticsResult {
  [entityId: string]: StatisticsDataPoint[];
}

export interface StatisticsDataPoint {
  start: string;
  end: string;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  sum?: number | null;
  state?: number | null;
  change?: number | null;
}

// ── Home Assistant (minimal declarations) ─────────────────────

export interface HomeAssistant {
  callWS: <T>(msg: Record<string, unknown>) => Promise<T>;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ) => Promise<void>;
  states: Record<string, HassEntity>;
  themes: {
    darkMode: boolean;
  };
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}
