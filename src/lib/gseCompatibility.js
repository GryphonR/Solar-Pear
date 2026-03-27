export const GSE_COMPATIBILITY = {
    BOTH: 'Both',
    NONE: 'None',
    PORTRAIT_ONLY: 'Portrait Only',
    LANDSCAPE_ONLY: 'Landscape Only',
};

export const GSE_COMPATIBILITY_OPTIONS = [
    GSE_COMPATIBILITY.BOTH,
    GSE_COMPATIBILITY.NONE,
    GSE_COMPATIBILITY.PORTRAIT_ONLY,
    GSE_COMPATIBILITY.LANDSCAPE_ONLY,
];

export function getPanelGseCompatibility(panel) {
    return panel?.gseCompatibility || GSE_COMPATIBILITY.BOTH;
}

export function getGseCompatibilityDbLabel(value) {
    if (value === GSE_COMPATIBILITY.NONE) return 'None (Not GSE Compatible)';
    return value || GSE_COMPATIBILITY.BOTH;
}
