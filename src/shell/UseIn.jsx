/**
 * @file UseIn.jsx
 * Library "Use in…" actions (roadmap 13.6): put a panel on an array, or add a controller to a system,
 * straight from the catalogue tables.
 */

import React from 'react';
import { useNavigate } from 'react-router';
import Menu, { MenuHeading, MenuItem } from '../components/ui/Menu';
import { buildPath } from '../lib/routes';
import { useDataState, useUiState } from '../context/AppStateContext';

const BUTTON = 'h-8 whitespace-nowrap rounded-md border border-line-strong bg-white px-2.5 font-plex text-xs font-semibold text-body hover:bg-paper';

export function PanelUseIn({ panel }) {
    const { activeProject, updateSelection } = useDataState();
    const { setNotification } = useUiState();
    const navigate = useNavigate();
    return (
        <Menu label="Use in…" ariaLabel={`Use ${panel.name} in an array`} menuLabel={`Use ${panel.name} in`} align="right" buttonClassName={BUTTON}>
            {(close) =>
                activeProject.systems.map((system) => {
                    const arrays = activeProject.arrays.filter((a) => a.systemId === system.id);
                    return (
                        <React.Fragment key={system.id}>
                            <MenuHeading>{system.name}</MenuHeading>
                            {arrays.length === 0 ? <p className="px-2.5 pb-2 text-xs text-muted">No arrays yet</p> : null}
                            {arrays.map((array) => (
                                <MenuItem
                                    key={array.id}
                                    hint={array.panel === panel.model ? 'already using it' : undefined}
                                    onSelect={() => {
                                        close();
                                        updateSelection(array.id, 'panel', panel.model);
                                        const to = buildPath({ view: 'array', projectId: activeProject.id, systemId: system.id, arrayId: array.id, tab: 'overview' });
                                        setNotification(`${panel.name} set on ${array.name}.`, 'dark', { label: 'Open', onClick: () => navigate(to) });
                                    }}
                                >
                                    {array.name}
                                </MenuItem>
                            ))}
                        </React.Fragment>
                    );
                })
            }
        </Menu>
    );
}

export function ControllerUseIn({ controller }) {
    const { activeProject, createControllerInstance } = useDataState();
    const { setNotification } = useUiState();
    const navigate = useNavigate();
    const name = `${controller.manufacturer ? `${controller.manufacturer} ` : ''}${controller.name}`;
    return (
        <Menu label="Use in…" ariaLabel={`Add ${name} to a system`} menuLabel={`Add ${name} to`} align="right" buttonClassName={BUTTON}>
            {(close) => (
                <>
                    <MenuHeading>Add to a system</MenuHeading>
                    {activeProject.systems.map((system) => (
                        <MenuItem
                            key={system.id}
                            onSelect={() => {
                                close();
                                createControllerInstance(controller.id, system.name);
                                const to = buildPath({ view: 'system', projectId: activeProject.id, systemId: system.id, tab: 'controllers' });
                                setNotification(`${name} added to ${system.name}. Give it an array on the Controllers tab.`, 'dark', {
                                    label: 'Open',
                                    onClick: () => navigate(to),
                                });
                            }}
                        >
                            {system.name}
                        </MenuItem>
                    ))}
                </>
            )}
        </Menu>
    );
}
