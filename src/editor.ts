import { LitElement, html, TemplateResult, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import {
  StackLineCardConfig,
  EntityConfig,
  HomeAssistant,
  PeriodType,
  StatType,
  ChartType,
  ActionConfig,
  ActionType,
  GridOptions,
  FilterOperator,
  TimeFilter,
} from "./types";
import {
  DEFAULT_CONFIG,
  DEFAULT_GRID_OPTIONS,
  COLOR_PALETTE,
  STAT_LABELS,
  PERIOD_LABELS,
  ACTION_LABELS,
  FILTER_OPERATOR_LABELS,
} from "./constants";
import { editorStyles } from "./styles";

class StackLineCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: StackLineCardConfig;
  @state() private _helpers: any;
  @state() private _chartSettingsOpen = true;
  @state() private _entitiesOpen = true;
  @state() private _interactionsOpen = false;
  @state() private _filterOpen = false;
  @state() private _layoutOpen = false;

  public setConfig(config: StackLineCardConfig): void {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      entities: config.entities || [],
    } as StackLineCardConfig;
    this._loadHelpers();
  }

  private async _loadHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private _fireConfigChanged(): void {
    const event = new CustomEvent("config-changed", {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config || !this._helpers) return html``;

    return html`
      <div class="editor-container">
        ${this._renderChartSettings()}
        ${this._renderEntitiesSection()}
        ${this._renderFilterSection()}
        ${this._renderInteractionsSection()}
        ${this._renderLayoutSection()}
      </div>
    `;
  }

  // ── Chart Settings Section ──────────────────────────────────

  private _renderChartSettings(): TemplateResult {
    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() => (this._chartSettingsOpen = !this._chartSettingsOpen)}
        >
          <h3>Chart Settings</h3>
          <ha-icon
            icon="mdi:chevron-${this._chartSettingsOpen ? "up" : "down"}"
          ></ha-icon>
        </div>
        ${this._chartSettingsOpen
          ? html`
              <div class="section-content">
                <ha-textfield
                  label="Title"
                  .value=${this._config.title || ""}
                  @input=${this._titleChanged}
                ></ha-textfield>

                <div class="row">
                  <ha-textfield
                    label="Hours to show"
                    type="number"
                    min="1"
                    max="8760"
                    .value=${String(this._config.hours_to_show)}
                    @input=${this._hoursChanged}
                  ></ha-textfield>

                  <ha-select
                    label="Period"
                    .value=${this._config.period}
                    @selected=${this._periodChanged}
                    @closed=${(e: Event) => e.stopPropagation()}
                    fixedMenuPosition
                  >
                    ${Object.entries(PERIOD_LABELS).map(
                      ([value, label]) => html`
                        <mwc-list-item .value=${value}>${label}</mwc-list-item>
                      `,
                    )}
                  </ha-select>
                </div>

                <div class="row">
                  <ha-select
                    label="Chart type"
                    .value=${this._config.chart_type}
                    @selected=${this._chartTypeChanged}
                    @closed=${(e: Event) => e.stopPropagation()}
                    fixedMenuPosition
                  >
                    <mwc-list-item value="line">Line</mwc-list-item>
                    <mwc-list-item value="area">Area (Filled)</mwc-list-item>
                  </ha-select>
                </div>

                <div class="switch-row">
                  <div>
                    <span>Stacked</span>
                    <div class="helper">
                      Stack series on top of each other
                    </div>
                  </div>
                  <ha-switch
                    .checked=${this._config.stacked}
                    @change=${this._stackedChanged}
                  ></ha-switch>
                </div>

                <div class="switch-row">
                  <div>
                    <span>Normalize Y-axis</span>
                    <div class="helper">
                      Scale all series to 0-100% for trend comparison
                    </div>
                  </div>
                  <ha-switch
                    .checked=${this._config.normalize}
                    @change=${this._normalizeChanged}
                  ></ha-switch>
                </div>

                <div class="switch-row">
                  <span>Show legend</span>
                  <ha-switch
                    .checked=${this._config.show_legend}
                    @change=${this._legendChanged}
                  ></ha-switch>
                </div>

                <div class="switch-row">
                  <span>Show data points</span>
                  <ha-switch
                    .checked=${this._config.show_points}
                    @change=${this._pointsChanged}
                  ></ha-switch>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Entities Section ────────────────────────────────────────

  private _renderEntitiesSection(): TemplateResult {
    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() => (this._entitiesOpen = !this._entitiesOpen)}
        >
          <h3>Entities (${this._config.entities.length})</h3>
          <ha-icon
            icon="mdi:chevron-${this._entitiesOpen ? "up" : "down"}"
          ></ha-icon>
        </div>
        ${this._entitiesOpen
          ? html`
              <div class="section-content">
                ${this._config.entities.map((entity, index) =>
                  this._renderEntityCard(entity, index),
                )}
                <ha-button class="add-entity-btn" @click=${this._addEntity}>
                  <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
                  Add Entity
                </ha-button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderEntityCard(
    entity: EntityConfig,
    index: number,
  ): TemplateResult {
    const color =
      entity.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
    const showFillOptions =
      this._config.chart_type === "area" || entity.fill === true;

    return html`
      <div class="entity-card">
        <div class="entity-header">
          <span>Entity ${index + 1}</span>
          <ha-icon-button
            .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}
            @click=${() => this._removeEntity(index)}
          ></ha-icon-button>
        </div>

        <div class="entity-fields">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: "sensor" } }}
            .value=${entity.entity}
            .label=${"Entity"}
            @value-changed=${(e: CustomEvent) =>
              this._entityValueChanged(index, "entity", e.detail.value)}
          ></ha-selector>

          <div class="entity-row">
            <ha-select
              label="Statistic"
              .value=${entity.stat || "mean"}
              @selected=${(e: CustomEvent) => {
                const target = e.target as any;
                if (target?.value) {
                  this._entityValueChanged(index, "stat", target.value);
                }
              }}
              @closed=${(e: Event) => e.stopPropagation()}
              fixedMenuPosition
            >
              ${Object.entries(STAT_LABELS).map(
                ([value, label]) => html`
                  <mwc-list-item .value=${value}>${label}</mwc-list-item>
                `,
              )}
            </ha-select>

            <div class="color-input-wrapper">
              <label>Color</label>
              <input
                type="color"
                .value=${color}
                @input=${(e: Event) =>
                  this._entityValueChanged(
                    index,
                    "color",
                    (e.target as HTMLInputElement).value,
                  )}
              />
            </div>
          </div>

          <ha-textfield
            label="Display name (optional)"
            .value=${entity.name || ""}
            .placeholder=${this._getFriendlyName(entity.entity) ||
            "Entity name"}
            @input=${(e: Event) =>
              this._entityValueChanged(
                index,
                "name",
                (e.target as HTMLInputElement).value,
              )}
          ></ha-textfield>

          <div class="switch-row">
            <span>Fill under line</span>
            <ha-switch
              .checked=${entity.fill ?? this._config.chart_type === "area"}
              @change=${(e: Event) =>
                this._entityValueChanged(
                  index,
                  "fill",
                  (e.target as HTMLInputElement).checked,
                )}
            ></ha-switch>
          </div>

          ${showFillOptions
            ? html`
                <div class="opacity-row">
                  <label>Fill opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    .value=${String(entity.opacity ?? 0.3)}
                    @input=${(e: Event) =>
                      this._entityValueChanged(
                        index,
                        "opacity",
                        parseFloat((e.target as HTMLInputElement).value),
                      )}
                  />
                  <span class="value"
                    >${(entity.opacity ?? 0.3).toFixed(2)}</span
                  >
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  // ── Interactions Section ────────────────────────────────────
  private _renderFilterSection(): TemplateResult {
    const filter = this._config.time_filter;
    const hasFilter = !!filter?.entity;

    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() => (this._filterOpen = !this._filterOpen)}
        >
          <h3>Time Filter${hasFilter ? " ✓" : ""}</h3>
          <ha-icon
            icon="mdi:chevron-${this._filterOpen ? "up" : "down"}"
          ></ha-icon>
        </div>
        ${this._filterOpen
          ? html`
              <div class="section-content">
                <div class="helper-text">
                  Only show time periods where an entity's value meets a
                  condition
                </div>

                <div class="switch-row">
                  <span>Enable filter</span>
                  <ha-switch
                    .checked=${hasFilter}
                    @change=${this._filterToggleChanged}
                  ></ha-switch>
                </div>

                ${hasFilter
                  ? html`
                      <ha-selector
                        .hass=${this.hass}
                        .selector=${{ entity: { domain: "sensor" } }}
                        .value=${filter!.entity}
                        .label=${"Filter entity"}
                        @value-changed=${(e: CustomEvent) =>
                          this._filterFieldChanged(
                            "entity",
                            e.detail.value,
                          )}
                      ></ha-selector>

                      <div class="row">
                        <ha-select
                          label="Statistic to compare"
                          .value=${filter!.stat || "mean"}
                          @selected=${(e: CustomEvent) => {
                            const target = e.target as any;
                            if (target?.value) {
                              this._filterFieldChanged(
                                "stat",
                                target.value,
                              );
                            }
                          }}
                          @closed=${(e: Event) => e.stopPropagation()}
                          fixedMenuPosition
                        >
                          ${Object.entries(STAT_LABELS).map(
                            ([value, label]) => html`
                              <mwc-list-item .value=${value}
                                >${label}</mwc-list-item
                              >
                            `,
                          )}
                        </ha-select>

                        <ha-select
                          label="Operator"
                          .value=${filter!.operator || "gt"}
                          @selected=${(e: CustomEvent) => {
                            const target = e.target as any;
                            if (target?.value) {
                              this._filterFieldChanged(
                                "operator",
                                target.value,
                              );
                            }
                          }}
                          @closed=${(e: Event) => e.stopPropagation()}
                          fixedMenuPosition
                        >
                          ${Object.entries(FILTER_OPERATOR_LABELS).map(
                            ([value, label]) => html`
                              <mwc-list-item .value=${value}
                                >${label}</mwc-list-item
                              >
                            `,
                          )}
                        </ha-select>
                      </div>

                      <ha-textfield
                        label="Threshold value"
                        type="number"
                        .value=${String(filter!.value ?? "")}
                        @input=${(e: Event) => {
                          const val = parseFloat(
                            (e.target as HTMLInputElement).value,
                          );
                          if (!isNaN(val)) {
                            this._filterFieldChanged("value", val);
                          }
                        }}
                      ></ha-textfield>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _filterToggleChanged(e: Event): void {
    const enabled = (e.target as HTMLInputElement).checked;
    if (enabled) {
      this._config = {
        ...this._config,
        time_filter: {
          entity: "",
          stat: "mean",
          operator: "gt",
          value: 0,
        },
      };
    } else {
      const { time_filter, ...rest } = this._config;
      this._config = rest as StackLineCardConfig;
    }
    this._fireConfigChanged();
  }

  private _filterFieldChanged(field: string, value: any): void {
    const current = this._config.time_filter || {
      entity: "",
      stat: "mean" as StatType,
      operator: "gt" as FilterOperator,
      value: 0,
    };
    this._config = {
      ...this._config,
      time_filter: { ...current, [field]: value },
    };
    this._fireConfigChanged();
  }

  // ── Interactions Section (Actions) ─────────────────────────
  private _renderInteractionsSection(): TemplateResult {
    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() =>
            (this._interactionsOpen = !this._interactionsOpen)}
        >
          <h3>Interactions</h3>
          <ha-icon
            icon="mdi:chevron-${this._interactionsOpen ? "up" : "down"}"
          ></ha-icon>
        </div>
        ${this._interactionsOpen
          ? html`
              <div class="section-content">
                ${this._renderActionEditor("tap_action", "Tap action")}
                ${this._renderActionEditor("hold_action", "Hold action")}
                ${this._renderActionEditor(
                  "double_tap_action",
                  "Double tap action",
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderActionEditor(
    key: "tap_action" | "hold_action" | "double_tap_action",
    label: string,
  ): TemplateResult {
    const action = this._config[key] || { action: "none" as ActionType };

    return html`
      <div class="action-block">
        <ha-select
          label=${label}
          .value=${action.action}
          @selected=${(e: CustomEvent) => {
            const target = e.target as any;
            if (target?.value) {
              this._actionTypeChanged(key, target.value as ActionType);
            }
          }}
          @closed=${(e: Event) => e.stopPropagation()}
          fixedMenuPosition
        >
          ${Object.entries(ACTION_LABELS).map(
            ([value, lbl]) => html`
              <mwc-list-item .value=${value}>${lbl}</mwc-list-item>
            `,
          )}
        </ha-select>

        ${action.action === "more-info" || action.action === "toggle"
          ? html`
              <ha-selector
                .hass=${this.hass}
                .selector=${{ entity: {} }}
                .value=${action.entity || ""}
                .label=${"Entity (defaults to first)"}
                @value-changed=${(e: CustomEvent) =>
                  this._actionFieldChanged(key, "entity", e.detail.value)}
              ></ha-selector>
            `
          : nothing}
        ${action.action === "navigate"
          ? html`
              <ha-textfield
                label="Navigation path"
                .value=${action.navigation_path || ""}
                placeholder="/lovelace/0"
                @input=${(e: Event) =>
                  this._actionFieldChanged(
                    key,
                    "navigation_path",
                    (e.target as HTMLInputElement).value,
                  )}
              ></ha-textfield>
            `
          : nothing}
        ${action.action === "url"
          ? html`
              <ha-textfield
                label="URL"
                .value=${action.url_path || ""}
                placeholder="https://..."
                @input=${(e: Event) =>
                  this._actionFieldChanged(
                    key,
                    "url_path",
                    (e.target as HTMLInputElement).value,
                  )}
              ></ha-textfield>
            `
          : nothing}
        ${action.action === "perform-action"
          ? html`
              <ha-textfield
                label="Action (domain.service)"
                .value=${action.perform_action || ""}
                placeholder="light.turn_on"
                @input=${(e: Event) =>
                  this._actionFieldChanged(
                    key,
                    "perform_action",
                    (e.target as HTMLInputElement).value,
                  )}
              ></ha-textfield>
            `
          : nothing}
      </div>
    `;
  }

  // ── Layout Section ──────────────────────────────────────────

  private _renderLayoutSection(): TemplateResult {
    const grid = this._config.grid_options || DEFAULT_GRID_OPTIONS;

    return html`
      <div class="section">
        <div
          class="section-header"
          @click=${() => (this._layoutOpen = !this._layoutOpen)}
        >
          <h3>Layout</h3>
          <ha-icon
            icon="mdi:chevron-${this._layoutOpen ? "up" : "down"}"
          ></ha-icon>
        </div>
        ${this._layoutOpen
          ? html`
              <div class="section-content">
                <div class="helper-text">
                  Grid sizing for sections-based dashboards
                </div>
                <div class="row">
                  <ha-textfield
                    label="Columns"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.columns)}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "columns",
                        parseInt((e.target as HTMLInputElement).value, 10),
                      )}
                  ></ha-textfield>
                  <ha-textfield
                    label="Rows"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.rows)}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "rows",
                        parseInt((e.target as HTMLInputElement).value, 10),
                      )}
                  ></ha-textfield>
                </div>
                <div class="row">
                  <ha-textfield
                    label="Min columns"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.min_columns ?? "")}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "min_columns",
                        parseInt((e.target as HTMLInputElement).value, 10) ||
                          undefined,
                      )}
                  ></ha-textfield>
                  <ha-textfield
                    label="Max columns"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.max_columns ?? "")}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "max_columns",
                        parseInt((e.target as HTMLInputElement).value, 10) ||
                          undefined,
                      )}
                  ></ha-textfield>
                </div>
                <div class="row">
                  <ha-textfield
                    label="Min rows"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.min_rows ?? "")}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "min_rows",
                        parseInt((e.target as HTMLInputElement).value, 10) ||
                          undefined,
                      )}
                  ></ha-textfield>
                  <ha-textfield
                    label="Max rows"
                    type="number"
                    min="1"
                    max="12"
                    .value=${String(grid.max_rows ?? "")}
                    @input=${(e: Event) =>
                      this._gridChanged(
                        "max_rows",
                        parseInt((e.target as HTMLInputElement).value, 10) ||
                          undefined,
                      )}
                  ></ha-textfield>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Event Handlers ──────────────────────────────────────────

  private _titleChanged(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._config = { ...this._config, title: value || undefined };
    this._fireConfigChanged();
  }

  private _hoursChanged(e: Event): void {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value > 0) {
      this._config = { ...this._config, hours_to_show: value };
      this._fireConfigChanged();
    }
  }

  private _periodChanged(e: CustomEvent): void {
    const target = e.target as any;
    if (target?.value) {
      this._config = {
        ...this._config,
        period: target.value as PeriodType,
      };
      this._fireConfigChanged();
    }
  }

  private _chartTypeChanged(e: CustomEvent): void {
    const target = e.target as any;
    if (target?.value) {
      this._config = {
        ...this._config,
        chart_type: target.value as ChartType,
      };
      this._fireConfigChanged();
    }
  }

  private _stackedChanged(e: Event): void {
    this._config = {
      ...this._config,
      stacked: (e.target as HTMLInputElement).checked,
    };
    this._fireConfigChanged();
  }

  private _normalizeChanged(e: Event): void {
    this._config = {
      ...this._config,
      normalize: (e.target as HTMLInputElement).checked,
    };
    this._fireConfigChanged();
  }

  private _legendChanged(e: Event): void {
    this._config = {
      ...this._config,
      show_legend: (e.target as HTMLInputElement).checked,
    };
    this._fireConfigChanged();
  }

  private _pointsChanged(e: Event): void {
    this._config = {
      ...this._config,
      show_points: (e.target as HTMLInputElement).checked,
    };
    this._fireConfigChanged();
  }

  private _addEntity(): void {
    const nextIndex = this._config.entities.length;
    const newEntity: EntityConfig = {
      entity: "",
      stat: "mean",
      color: COLOR_PALETTE[nextIndex % COLOR_PALETTE.length],
      fill: this._config.chart_type === "area",
      opacity: 0.3,
    };
    this._config = {
      ...this._config,
      entities: [...this._config.entities, newEntity],
    };
    this._fireConfigChanged();
  }

  private _removeEntity(index: number): void {
    const entities = [...this._config.entities];
    entities.splice(index, 1);
    this._config = { ...this._config, entities };
    this._fireConfigChanged();
  }

  private _entityValueChanged(
    index: number,
    key: keyof EntityConfig,
    value: any,
  ): void {
    const entities = [...this._config.entities];
    entities[index] = { ...entities[index], [key]: value };
    this._config = { ...this._config, entities };
    this._fireConfigChanged();
  }

  // Action handlers

  private _actionTypeChanged(
    key: "tap_action" | "hold_action" | "double_tap_action",
    actionType: ActionType,
  ): void {
    this._config = {
      ...this._config,
      [key]: { action: actionType },
    };
    this._fireConfigChanged();
  }

  private _actionFieldChanged(
    key: "tap_action" | "hold_action" | "double_tap_action",
    field: string,
    value: string,
  ): void {
    const current = this._config[key] || { action: "none" as ActionType };
    this._config = {
      ...this._config,
      [key]: { ...current, [field]: value },
    };
    this._fireConfigChanged();
  }

  // Grid handlers

  private _gridChanged(field: keyof GridOptions, value: any): void {
    const current = this._config.grid_options || { ...DEFAULT_GRID_OPTIONS };
    const updated = { ...current, [field]: value };
    // Remove undefined fields
    if (value === undefined || isNaN(value)) {
      delete (updated as any)[field];
    }
    this._config = { ...this._config, grid_options: updated };
    this._fireConfigChanged();
  }

  // Helpers

  private _getFriendlyName(entityId: string): string | undefined {
    return this.hass?.states?.[entityId]?.attributes?.friendly_name;
  }
}

customElements.define("stack-line-card-editor", StackLineCardEditor);
