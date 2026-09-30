/** A projects store with known ids, for routing and shell tests. */
export function seedProjectsStore() {
    const array = (id, name, systemId) => ({
        id,
        name,
        systemId,
        orientation: 'South',
        count: 1,
        format: 'Portrait',
        mounting: 'On Roof',
        maxPanelHeight: '',
        maxPanelWidth: '',
        maxPanelWeight: '',
        panel: '',
        controllerInstanceId: '',
        controllerMppt: 1,
        controller: '',
    });
    const now = '2026-09-30T12:00:00.000Z';
    return {
        version: 1,
        activeProjectId: 'proj_home',
        projects: [
            {
                id: 'proj_home',
                name: 'Hawthorn Cottage',
                kind: 'local',
                createdAt: now,
                updatedAt: now,
                systems: [
                    { id: 'sys_house', name: 'House', settings: {} },
                    { id: 'sys_barn', name: 'Barn', settings: {} },
                ],
                arrays: [array('A1', 'South roof', 'sys_house'), array('A2', 'Barn roof', 'sys_barn')],
                siteControllers: [],
            },
            {
                id: 'proj_van',
                name: 'Van',
                kind: 'local',
                createdAt: now,
                updatedAt: now,
                systems: [{ id: 'sys_van', name: 'Van', settings: {} }],
                arrays: [array('V1', 'Van roof', 'sys_van')],
                siteControllers: [],
            },
        ],
    };
}
