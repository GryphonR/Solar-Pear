import React from 'react';
import { Link } from 'react-router';
import { CONTROLLER_FILTERS, labelOf } from '../lib/presets';
import { systemMeta } from '../lib/designStatus';

/**
 * Read-only line of a system's settings for pages inside the system (roadmap 13.5): the settings apply to
 * every array in the system, so they're edited only in System Setup.
 */
export default function SystemSettingsSummary({ systemName, settings, setupTo }) {
    const filters = [labelOf(CONTROLLER_FILTERS, settings.systemType) || 'All controllers'];
    if (settings.systemType === 'grid-connected' && settings.filterEps) filters.push('EPS output');
    if (settings.systemType === 'grid-connected' && settings.filterHouseBackup) filters.push('whole-house backup');
    const meta = systemMeta(settings, 0).replace(/ · 0 arrays$|^0 arrays$/, '');

    return (
        <div data-testid="system-settings-summary" className="flex flex-wrap items-center gap-x-4 gap-y-1 font-plex text-[13px] text-subtle">
            <span className="font-semibold text-body">{systemName} settings</span>
            {meta ? <span>{meta}</span> : null}
            <span>Showing: {filters.join(', ')}</span>
            <span className="font-plex-mono">
                {settings.designLowC} °C cold · {settings.designHighC} °C cell
            </span>
            <span>Strict current {settings.strictCurrent ? 'on' : 'off'}</span>
            <Link to={setupTo} className="font-semibold text-secondary hover:underline">
                Edit in System Setup
            </Link>
        </div>
    );
}
