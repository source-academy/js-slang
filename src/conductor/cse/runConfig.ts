import type { IRunnerPlugin } from '@sourceacademy/conductor/runner';

/**
 * Per-run settings the host serves as a virtual `/__run_config__` file, fetched through
 * `IRunnerPlugin.requestFile` — Conductor has no dedicated message type for either field, and
 * `requestFile` is its only generic inbound channel.
 *
 * The frontend already writes this on every run; see
 * `frontend/src/commons/sagas/WorkspaceSaga/helpers/evalCode.ts`, which sends
 * `{ stepLimit, breakpointLines }`.
 */
export interface RunConfig {
  /** The user's "Step Limit" control, used as the cap on how many snapshots are collected. */
  stepLimit?: number;
  /** 1-indexed editor lines carrying a gutter breakpoint. */
  breakpointLines?: number[];
}

/** js-slang's own default step budget, matching the frontend's step-limit control. Used when the
 * host serves no config at all. */
export const DEFAULT_STEP_LIMIT = 1000;

/**
 * The most steps that the Stepper records in a run, as a safety net and not a setting: the trace
 * is held in memory by the worker and then by the host, and its size grows faster than the number
 * of steps for a recursive program, whose expression grows with the recursion (measured for
 * `function f(n) { return n === 0 ? 0 : 1 + f(n - 1); } f(100000);`: 1000 steps are 15 MB once
 * serialised, 5000 steps are 323 MB and take five seconds). A student who wants to see less presses
 * Stop, and the steps so far are kept. The host's `stepLimit`, while it still sends one, is a
 * lower cap.
 */
export const STEPPER_STEP_CAP = 3000;

/**
 * The most snapshots that the CSE machine records in a run, a safety net like {@link STEPPER_STEP_CAP}
 * and for the same reason (a snapshot holds the control, the stash and the environments, which grow
 * with the recursion or the data). Measured on programs of 1,000,000 steps cut at the cap: 2500
 * snapshots serialise to 83 MB for a deep recursion, 113 MB for building a long list and 27 MB for a
 * loop of constant size; 5000 to 278, 400 and 54 MB, taking up to three seconds. The host's
 * `stepLimit`, while it still sends one, is a lower cap.
 */
export const CSE_STEP_CAP = 2500;

/** The file of the per-run settings. Hosts served it as `/__cse_config__` before the rename. */
const RUN_CONFIG_FILE = '/__run_config__';
const LEGACY_RUN_CONFIG_FILE = '/__cse_config__';

/**
 * Fetches and parses `/__run_config__`, or `/__cse_config__` from a host that has not been renamed
 * yet. A missing or malformed file falls back to `{}` rather than failing the run: every field is
 * optional and callers apply their own defaults, so a config problem should never cost the user
 * their program's output.
 */
export async function fetchRunConfig(conductor: IRunnerPlugin): Promise<RunConfig> {
  try {
    const raw =
      (await conductor.requestFile(RUN_CONFIG_FILE)) ||
      (await conductor.requestFile(LEGACY_RUN_CONFIG_FILE));
    if (!raw) return {};
    return JSON.parse(raw) as RunConfig;
  } catch {
    return {};
  }
}
