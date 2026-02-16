import { LitElement, html, PropertyValues, TemplateResult, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Legend,
  Tooltip,
  ChartConfiguration,
  ChartDataset,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  StackLineCardConfig,
  EntityConfig,
  HomeAssistant,
  StatisticsResult,
  StatisticsDataPoint,
  StatType,
  ActionConfig,
  GridOptions,
} from "./types";
import {
  DEFAULT_CONFIG,
  DEFAULT_GRID_OPTIONS,
  COLOR_PALETTE,
  FETCH_THROTTLE_MS,
  HOLD_THRESHOLD_MS,
  DOUBLE_TAP_THRESHOLD_MS,
} from "./constants";
import { cardStyles } from "./styles";
import "./editor";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Legend,
  Tooltip,
);

class StackLineCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: StackLineCardConfig;
  @state() private _loading = true;
  @state() private _noData = false;

  private _chart?: Chart;
  private _resizeObserver?: ResizeObserver;
  private _lastFetchTime = 0;
  private _lastConfigHash = "";
  private _fetchTimer?: number;

  // Action gesture tracking
  private _holdTimer?: number;
  private _holdFired = false;
  private _lastTapTime = 0;
  private _tapTimer?: number;

  // ── Lovelace Card API ───────────────────────────────────────

  static getConfigElement(): HTMLElement {
    return document.createElement("stack-line-card-editor");
  }

  static getStubConfig(): Partial<StackLineCardConfig> {
    return {
      ...DEFAULT_CONFIG,
      entities: [],
    };
  }

  public setConfig(config: Partial<StackLineCardConfig>): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      entities: config.entities || [],
    } as StackLineCardConfig;
  }

  public getCardSize(): number {
    return this._config?.grid_options?.rows ?? 4;
  }

  public getGridOptions(): GridOptions {
    return this._config?.grid_options ?? DEFAULT_GRID_OPTIONS;
  }

  // ── Lifecycle ───────────────────────────────────────────────

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (changedProps.has("hass") || changedProps.has("_config")) {
      this._tryFetchData();
    }
  }

  protected firstUpdated(_changedProps: PropertyValues): void {
    super.firstUpdated(_changedProps);
    this._setupResizeObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._destroyChart();
    this._resizeObserver?.disconnect();
    if (this._fetchTimer) clearTimeout(this._fetchTimer);
    if (this._holdTimer) clearTimeout(this._holdTimer);
    if (this._tapTimer) clearTimeout(this._tapTimer);
  }

  // ── Render ──────────────────────────────────────────────────

  protected render(): TemplateResult {
    if (!this._config) return html``;

    const hasAction = this._hasAnyAction();

    return html`
      <ha-card
        class="${hasAction ? "interactive" : ""}"
        @pointerdown=${hasAction ? this._handlePointerDown : nothing}
        @pointerup=${hasAction ? this._handlePointerUp : nothing}
        @pointercancel=${hasAction ? this._handlePointerCancel : nothing}
        @contextmenu=${hasAction ? this._preventContext : nothing}
      >
        ${this._config.title
          ? html`<div class="card-header">${this._config.title}</div>`
          : nothing}
        ${this._loading
          ? html`<div class="loading">
              <ha-circular-progress indeterminate size="medium"></ha-circular-progress>
            </div>`
          : this._noData
            ? html`<div class="no-data">No data available</div>`
            : nothing}
        <div
          class="chart-container"
          style="${this._loading || this._noData ? "display:none" : ""}"
        >
          <canvas id="chart"></canvas>
        </div>
      </ha-card>
    `;
  }

  // ── Action Handling ─────────────────────────────────────────

  private _hasAnyAction(): boolean {
    const tap = this._config?.tap_action?.action;
    const hold = this._config?.hold_action?.action;
    const dblTap = this._config?.double_tap_action?.action;
    return (
      (!!tap && tap !== "none") ||
      (!!hold && hold !== "none") ||
      (!!dblTap && dblTap !== "none")
    );
  }

  private _handlePointerDown = (e: PointerEvent): void => {
    // Start hold detection
    this._holdFired = false;
    if (this._holdTimer) clearTimeout(this._holdTimer);

    const holdAction = this._config?.hold_action;
    if (holdAction && holdAction.action !== "none") {
      this._holdTimer = window.setTimeout(() => {
        this._holdFired = true;
        this._executeAction(holdAction);
      }, HOLD_THRESHOLD_MS);
    }
  };

  private _handlePointerUp = (e: PointerEvent): void => {
    // Cancel hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }

    if (this._holdFired) return; // Hold already fired, skip tap

    const now = Date.now();
    const dblTapAction = this._config?.double_tap_action;
    const tapAction = this._config?.tap_action;

    if (dblTapAction && dblTapAction.action !== "none") {
      // Double-tap detection
      if (now - this._lastTapTime < DOUBLE_TAP_THRESHOLD_MS) {
        // Second tap within window — fire double-tap
        if (this._tapTimer) clearTimeout(this._tapTimer);
        this._lastTapTime = 0;
        this._executeAction(dblTapAction);
      } else {
        // First tap — wait for potential second tap
        this._lastTapTime = now;
        if (this._tapTimer) clearTimeout(this._tapTimer);
        this._tapTimer = window.setTimeout(() => {
          this._lastTapTime = 0;
          if (tapAction && tapAction.action !== "none") {
            this._executeAction(tapAction);
          }
        }, DOUBLE_TAP_THRESHOLD_MS);
      }
    } else if (tapAction && tapAction.action !== "none") {
      this._executeAction(tapAction);
    }
  };

  private _handlePointerCancel = (): void => {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
  };

  private _preventContext = (e: Event): void => {
    const holdAction = this._config?.hold_action;
    if (holdAction && holdAction.action !== "none") {
      e.preventDefault();
    }
  };

  private _executeAction(actionConfig: ActionConfig): void {
    if (!this.hass || !actionConfig) return;

    // Confirmation dialog
    if (actionConfig.confirmation?.text) {
      if (!confirm(actionConfig.confirmation.text)) return;
    }

    switch (actionConfig.action) {
      case "more-info": {
        const entityId =
          actionConfig.entity || this._config.entities?.[0]?.entity;
        if (entityId) {
          this._fireHassEvent("hass-more-info", { entityId });
        }
        break;
      }
      case "toggle": {
        const entityId =
          actionConfig.entity || this._config.entities?.[0]?.entity;
        if (entityId) {
          this.hass.callService("homeassistant", "toggle", {
            entity_id: entityId,
          });
        }
        break;
      }
      case "navigate":
        if (actionConfig.navigation_path) {
          history.pushState(null, "", actionConfig.navigation_path);
          this._fireHassEvent("location-changed", {
            replace: false,
          });
        }
        break;
      case "url":
        if (actionConfig.url_path) {
          window.open(actionConfig.url_path, "_blank");
        }
        break;
      case "perform-action": {
        if (actionConfig.perform_action) {
          const [domain, service] = actionConfig.perform_action.split(".", 2);
          if (domain && service) {
            this.hass.callService(
              domain,
              service,
              actionConfig.data || {},
              actionConfig.target || {},
            );
          }
        }
        break;
      }
      case "assist":
        this._fireHassEvent("show-dialog", {
          dialogTag: "dialog-voice-command",
          dialogImport: undefined,
          dialogParams: {},
        });
        break;
      case "none":
      default:
        break;
    }

    // Haptic feedback
    this._fireHassEvent("haptic", "light");
  }

  private _fireHassEvent(type: string, detail: any): void {
    const event = new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail,
    });
    this.dispatchEvent(event);
  }

  // ── Resize Observer ─────────────────────────────────────────

  private _setupResizeObserver(): void {
    this._resizeObserver = new ResizeObserver(() => {
      this._chart?.resize();
    });
    const container = this.shadowRoot?.querySelector(".chart-container");
    if (container) this._resizeObserver.observe(container);
  }

  // ── Data Fetching ───────────────────────────────────────────

  private _getConfigHash(): string {
    return JSON.stringify({
      entities: this._config.entities,
      hours: this._config.hours_to_show,
      period: this._config.period,
      stacked: this._config.stacked,
      chart_type: this._config.chart_type,
      normalize: this._config.normalize,
    });
  }

  private async _tryFetchData(): Promise<void> {
    if (!this.hass || !this._config?.entities?.length) {
      this._loading = false;
      this._noData = true;
      return;
    }

    const configHash = this._getConfigHash();
    const now = Date.now();

    if (
      configHash === this._lastConfigHash &&
      now - this._lastFetchTime < FETCH_THROTTLE_MS
    ) {
      return;
    }

    this._lastConfigHash = configHash;
    this._lastFetchTime = now;

    try {
      this._loading = true;
      const data = await this._fetchStatistics();
      if (data) {
        this._noData = false;
        await this.updateComplete;
        this._buildChart(data);
      } else {
        this._noData = true;
      }
    } catch (err) {
      console.error("stack-line-card: Failed to fetch statistics", err);
      this._noData = true;
    } finally {
      this._loading = false;
      if (this._fetchTimer) clearTimeout(this._fetchTimer);
      this._fetchTimer = window.setTimeout(
        () => this._tryFetchData(),
        FETCH_THROTTLE_MS,
      );
    }
  }

  private async _fetchStatistics(): Promise<StatisticsResult | null> {
    const endTime = new Date();
    const startTime = new Date(
      endTime.getTime() - this._config.hours_to_show * 60 * 60 * 1000,
    );

    // Split entities: those with state_class use statistics API, others use history API
    const statsEntities: EntityConfig[] = [];
    const historyEntities: EntityConfig[] = [];

    for (const e of this._config.entities) {
      const stateObj = this.hass.states[e.entity];
      if (stateObj?.attributes?.state_class) {
        statsEntities.push(e);
      } else {
        historyEntities.push(e);
      }
    }

    const result: StatisticsResult = {};

    // Fetch in parallel
    const promises: Promise<void>[] = [];

    if (statsEntities.length > 0) {
      const neededTypes = new Set<string>();
      for (const e of statsEntities) {
        neededTypes.add(e.stat === "change" ? "state" : e.stat);
      }

      promises.push(
        this.hass
          .callWS<StatisticsResult>({
            type: "recorder/statistics_during_period",
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            statistic_ids: statsEntities.map((e) => e.entity),
            period: this._config.period,
            types: Array.from(neededTypes),
          })
          .then((statsResult) => {
            if (statsResult) Object.assign(result, statsResult);
          }),
      );
    }

    if (historyEntities.length > 0) {
      promises.push(
        this._fetchHistory(historyEntities, startTime, endTime).then(
          (histResult) => {
            Object.assign(result, histResult);
          },
        ),
      );
    }

    await Promise.all(promises);

    return Object.keys(result).length > 0 ? result : null;
  }

  private async _fetchHistory(
    entities: EntityConfig[],
    startTime: Date,
    endTime: Date,
  ): Promise<StatisticsResult> {
    interface HistoryEntry {
      s?: string;
      lu?: number;
      state?: string;
      last_updated?: string;
    }

    const historyData = await this.hass.callWS<
      Record<string, HistoryEntry[]>
    >({
      type: "history/history_during_period",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      entity_ids: entities.map((e) => e.entity),
      minimal_response: true,
      no_attributes: true,
    });

    if (!historyData) return {};

    const result: StatisticsResult = {};
    const periodMs = this._getPeriodMs();

    for (const entityConf of entities) {
      const entries = historyData[entityConf.entity];
      if (!entries || entries.length === 0) continue;

      // Parse numeric state values with timestamps
      const numericPoints: { time: number; value: number }[] = [];
      for (const entry of entries) {
        const stateStr = entry.s ?? entry.state;
        const time = entry.lu
          ? entry.lu * 1000
          : entry.last_updated
            ? new Date(entry.last_updated).getTime()
            : 0;
        if (!stateStr || !time) continue;
        const value = parseFloat(stateStr);
        if (!isNaN(value)) {
          numericPoints.push({ time, value });
        }
      }

      if (numericPoints.length === 0) continue;

      result[entityConf.entity] = this._bucketHistoryData(
        numericPoints,
        startTime.getTime(),
        periodMs,
      );
    }

    return result;
  }

  private _getPeriodMs(): number {
    switch (this._config.period) {
      case "5minute":
        return 5 * 60 * 1000;
      case "hour":
        return 60 * 60 * 1000;
      case "day":
        return 24 * 60 * 60 * 1000;
      case "week":
        return 7 * 24 * 60 * 60 * 1000;
      case "month":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private _bucketHistoryData(
    points: { time: number; value: number }[],
    startMs: number,
    periodMs: number,
  ): StatisticsDataPoint[] {
    const buckets = new Map<number, number[]>();

    for (const p of points) {
      const bucketStart =
        startMs + Math.floor((p.time - startMs) / periodMs) * periodMs;
      let bucket = buckets.get(bucketStart);
      if (!bucket) {
        bucket = [];
        buckets.set(bucketStart, bucket);
      }
      bucket.push(p.value);
    }

    const result: StatisticsDataPoint[] = [];
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const bucketStart of sortedKeys) {
      const values = buckets.get(bucketStart)!;
      const sum = values.reduce((a, b) => a + b, 0);

      result.push({
        start: new Date(bucketStart).toISOString(),
        end: new Date(bucketStart + periodMs).toISOString(),
        min: Math.min(...values),
        max: Math.max(...values),
        mean: sum / values.length,
        sum,
        state: values[values.length - 1],
        change: null,
      });
    }

    return result;
  }

  // ── Chart Building ──────────────────────────────────────────

  private _buildChart(data: StatisticsResult): void {
    const canvas = this.shadowRoot?.querySelector(
      "#chart",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;

    const datasets = this._buildDatasets(data);
    if (datasets.length === 0) {
      this._noData = true;
      return;
    }

    const textColor = this._getCSSVar("--primary-text-color", "#333");
    const gridColor = this._getCSSVar("--divider-color", "#e0e0e0");
    const secondaryText = this._getCSSVar("--secondary-text-color", "#666");

    const isNormalized = this._config.normalize;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: {
          mode: "index",
          intersect: false,
        },
        layout: {
          padding: { top: 4, right: 4, bottom: 0, left: 0 },
        },
        plugins: {
          legend: {
            display: this._config.show_legend,
            position: "bottom",
            labels: {
              color: secondaryText,
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 6,
              boxHeight: 6,
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.75)",
            titleColor: "#fff",
            bodyColor: "rgba(255,255,255,0.85)",
            titleFont: { size: 11, weight: "normal" as const },
            bodyFont: { size: 12 },
            borderWidth: 0,
            cornerRadius: 8,
            padding: { top: 8, bottom: 8, left: 10, right: 10 },
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: (ctx) => {
                const entityConf = this._config.entities[ctx.datasetIndex];
                const label = entityConf?.name || ctx.dataset.label || "";
                const unit = this._getUnit(entityConf?.entity);
                // Show raw value when normalized
                if (isNormalized) {
                  const rawPoints = this._rawDatasets.get(ctx.datasetIndex);
                  const rawVal = rawPoints?.[ctx.dataIndex]?.y;
                  const display =
                    rawVal != null ? rawVal.toFixed(2) : "N/A";
                  return ` ${label}: ${display}${unit ? " " + unit : ""}`;
                }
                const val =
                  ctx.parsed.y != null ? ctx.parsed.y.toFixed(2) : "N/A";
                return ` ${label}: ${val}${unit ? " " + unit : ""}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            ticks: {
              color: secondaryText,
              maxTicksLimit: 6,
              font: { size: 10 },
              padding: 4,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            stacked: this._config.stacked,
            ticks: {
              color: secondaryText,
              font: { size: 10 },
              padding: 6,
              maxTicksLimit: 5,
              ...(isNormalized
                ? {
                    callback: (value: any) =>
                      `${Math.round(Number(value) * 100)}%`,
                  }
                : {}),
            },
            grid: {
              color: this._hexToRgba(gridColor, 0.4),
              drawTicks: false,
            },
            border: { display: false, dash: [3, 3] },
            beginAtZero: this._config.stacked || isNormalized,
            ...(isNormalized ? { min: 0, max: 1 } : {}),
          },
        },
      },
    };

    if (this._chart) {
      this._chart.data.datasets = datasets;
      this._chart.options = config.options!;
      this._chart.update("none");
    } else {
      this._chart = new Chart(canvas, config);
    }
  }

  // Store raw values for tooltip display when normalized
  private _rawDatasets: Map<number, { x: number; y: number }[]> = new Map();

  private _buildDatasets(
    data: StatisticsResult,
  ): ChartDataset<"line", { x: number; y: number }[]>[] {
    this._rawDatasets.clear();

    return this._config.entities.map((entityConf, index) => {
      const color =
        entityConf.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
      const points = data[entityConf.entity] || [];
      const rawData = this._extractChartData(points, entityConf.stat);

      this._rawDatasets.set(index, rawData);

      const chartData =
        this._config.normalize ? this._normalizeData(rawData) : rawData;

      const isArea =
        this._config.chart_type === "area" || entityConf.fill === true;
      const opacity = entityConf.opacity ?? 0.3;

      return {
        label:
          entityConf.name ||
          this._getFriendlyName(entityConf.entity) ||
          entityConf.entity,
        data: chartData,
        borderColor: color,
        backgroundColor: isArea
          ? this._hexToRgba(color, opacity)
          : "transparent",
        fill: isArea ? (this._config.stacked ? "stack" : "origin") : false,
        tension: 0.4,
        pointRadius: this._config.show_points ? 2 : 0,
        pointHoverRadius: 4,
        borderWidth: 1.5,
        stack: this._config.stacked ? "stack" : undefined,
      } as ChartDataset<"line", { x: number; y: number }[]>;
    });
  }

  private _normalizeData(
    data: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    if (data.length === 0) return data;
    const values = data.map((d) => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return data.map((d) => ({ x: d.x, y: 0.5 }));
    return data.map((d) => ({
      x: d.x,
      y: (d.y - min) / range,
    }));
  }

  private _extractChartData(
    points: StatisticsDataPoint[],
    stat: StatType,
  ): { x: number; y: number }[] {
    if (stat === "change") {
      const result: { x: number; y: number }[] = [];
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1].state;
        const curr = points[i].state;
        if (prev != null && curr != null) {
          result.push({
            x: new Date(points[i].start).getTime(),
            y: curr - prev,
          });
        }
      }
      return result;
    }

    return points
      .filter((p) => p[stat] != null)
      .map((p) => ({
        x: new Date(p.start).getTime(),
        y: p[stat] as number,
      }));
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _getFriendlyName(entityId: string): string | undefined {
    return this.hass?.states?.[entityId]?.attributes?.friendly_name;
  }

  private _getUnit(entityId?: string): string {
    if (!entityId) return "";
    return (
      this.hass?.states?.[entityId]?.attributes?.unit_of_measurement || ""
    );
  }

  private _getCSSVar(name: string, fallback: string): string {
    return (
      getComputedStyle(this).getPropertyValue(name).trim() || fallback
    );
  }

  private _hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private _destroyChart(): void {
    if (this._chart) {
      this._chart.destroy();
      this._chart = undefined;
    }
  }
}

// Register the card
customElements.define("stack-line-card", StackLineCard);

// Register in HA card picker
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "stack-line-card",
  name: "Stack Line Card",
  description: "Stacked line/area graph with configurable statistics per entity",
  preview: false,
});
