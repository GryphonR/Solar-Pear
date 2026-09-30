/**
 * Status vocabulary for the new UI. Matches the engine's `evaluateElectrical` states
 * (error / warning / info / valid) plus "unset" for anything missing and therefore not checked.
 * Status never relies on colour alone: each one has an icon and a word.
 */
export const STATUS = {
    error: { label: 'Error', classes: 'bg-status-error-bg text-status-error-fg', description: 'Hard limit broken. Can damage hardware.' },
    warning: { label: 'Warning', classes: 'bg-status-warning-bg text-status-warning-fg', description: 'Works, but loses energy or margin.' },
    info: { label: 'Info', classes: 'bg-status-info-bg text-status-info-fg', description: 'Worth knowing. Never changes status.' },
    valid: { label: 'OK', classes: 'bg-status-ok-bg text-status-ok-fg', description: 'Every check passed.' },
    unset: { label: 'Not set', classes: 'border-[1.5px] border-dashed border-placeholder text-subtle', description: 'Missing, so not checked. Never green.' },
};

/** Maps an engine status string ('error' | 'warning' | 'valid' | 'info') to a STATUS key; anything else is 'unset'. */
export function statusKey(status) {
    return Object.prototype.hasOwnProperty.call(STATUS, status) ? status : 'unset';
}
