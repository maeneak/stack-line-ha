import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
  }

  ha-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }

  ha-card.interactive {
    cursor: pointer;
  }

  ha-card.interactive:active {
    opacity: 0.85;
  }

  .card-header {
    padding: 12px 16px 0;
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .chart-container {
    position: relative;
    padding: 8px 16px 16px;
    flex: 1;
    min-height: 200px;
  }

  .chart-container canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: var(--secondary-text-color);
  }

  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }
`;

export const editorStyles = css`
  :host {
    display: block;
  }

  .editor-container {
    padding: 0;
  }

  .section {
    margin-bottom: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color, #e0e0e0);
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .row > * {
    flex: 1;
    min-width: 120px;
  }

  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .switch-row span {
    color: var(--primary-text-color);
    font-size: 0.95rem;
  }

  .switch-row .helper {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .entity-card {
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .entity-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .entity-header span {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--primary-text-color);
  }

  .entity-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entity-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .entity-row > * {
    flex: 1;
    min-width: 100px;
  }

  .color-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 60px;
    max-width: 80px;
    flex: 0 0 auto;
  }

  .color-input-wrapper label {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
  }

  .color-input-wrapper input[type="color"] {
    width: 100%;
    height: 40px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 4px;
    cursor: pointer;
    background: none;
    padding: 2px;
  }

  .opacity-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .opacity-row label {
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .opacity-row input[type="range"] {
    flex: 1;
    accent-color: var(--primary-color);
  }

  .opacity-row .value {
    font-size: 0.85rem;
    color: var(--primary-text-color);
    min-width: 32px;
    text-align: right;
  }

  .add-entity-btn {
    width: 100%;
    margin-top: 8px;
  }

  ha-entity-picker {
    display: block;
    width: 100%;
  }

  .entity-row ha-entity-picker {
    flex: 2;
  }

  .action-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color, #e0e0e0);
  }

  .action-block:last-child {
    border-bottom: none;
  }

  .helper-text {
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    padding-bottom: 4px;
  }
`;
