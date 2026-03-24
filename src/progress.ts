export type LogLevel = "log" | "error" | "debug" | "warn";

/** Single log entry from a conversion step. */
export interface LogEntry {
  timestamp: number;
  plugin: string;
  message: string;
  level: LogLevel;
}

/** Context passed to doConvert for progress/log reporting. */
export interface ConvertContext {
  /**
   * Report progress.
   * @param message - Status message to display.
   * @param value - Absolute 0–1 value, or updater `(old) => new`.
   */
  progress: (message: string, value: number | ((prev: number) => number)) => void;
  /**
   * Append a timestamped log entry.
   * @param message - The log message.
   * @param level - Log level ('log', 'error', 'debug', 'warn'). Defaults to 'log'.
   */
  log: (message: string, level?: LogLevel) => void;
  /** AbortSignal for cooperative cancellation. */
  signal: AbortSignal;
  /** Throws if the signal has been aborted. Call between async steps. */
  throwIfAborted: () => void;
}

interface ProgressState {
  percent: number;
  message: string;
  logs: LogEntry[];
}

const state: ProgressState = { percent: 0, message: "", logs: [] };

let popupEl: HTMLDivElement | null = null;

function getPopup(): HTMLDivElement {
  popupEl ??= document.querySelector("#popup") as HTMLDivElement;
  return popupEl;
}

function renderProgress() {
  const popup = getPopup();
  const pct = Math.round(state.percent * 100);

  const logsHtml = state.logs
    .slice(-50)
    .map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString();
      return `<div class="log-entry log-level-${l.level}"><span class="log-time">${time}</span><span class="log-msg">${l.message}</span></div>`;
    })
    .join("");

  const progressHtml = state.percent > 0 ? `
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
    <p class="progress-percent">${pct}%</p>
  ` : "";

  popup.innerHTML = `
    <h2>${state.message || "Converting..."}</h2>
    ${progressHtml}
    <div class="log-container">${logsHtml}</div>
    <button id="cancel-convert" class="cancel-btn">Cancel</button>
  `;

  const cancelBtn = popup.querySelector("#cancel-convert");
  if (cancelBtn && currentAbortController) {
    const ac = currentAbortController;
    cancelBtn.addEventListener("click", () => ac.abort());
  }

  const logContainer = popup.querySelector(".log-container");
  if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
}

let currentAbortController: AbortController | null = null;

/**
 * Create an AbortController for the current conversion run.
 * Call once per conversion, before any handler steps.
 */
export function createConversionAbortController(): AbortController {
  currentAbortController = new AbortController();
  return currentAbortController;
}

/**
 * Create a {@link ConvertContext} scoped to a specific plugin.
 * @param pluginName - Handler name for log attribution.
 * @param signal - AbortSignal for cooperative cancellation.
 */
export function createConvertContext(pluginName: string, signal?: AbortSignal): ConvertContext {
  const fallbackAC = new AbortController();
  const sig = signal ?? fallbackAC.signal;
  return {
    progress(message, value) {
      state.message = message;
      state.percent = typeof value === "function" ? value(state.percent) : value;
      state.percent = Math.max(0, Math.min(1, state.percent));
      renderProgress();
    },
    log(message, level = "log") {
      state.logs.push({ timestamp: Date.now(), plugin: pluginName, message, level });
      renderProgress();
    },
    signal: sig,
    throwIfAborted() {
      if (sig.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    }
  };
}

/** Reset progress state (call before starting a new conversion). */
export function resetProgress() {
  state.percent = 0;
  state.message = "";
  state.logs = [];
}

/** Set top-level progress message and value without a ConvertContext. */
export function setProgress(message: string, percent: number) {
  state.message = message;
  state.percent = Math.max(0, Math.min(1, percent));
  renderProgress();
}
