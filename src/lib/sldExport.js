/**
 * @file sldExport.js
 * Standalone SVG of a single line diagram (roadmap 13.7, brief 7.5), drawn from the same `sldLayout`
 * output as the on-screen diagram. Black-on-white with the status spelled out in text, so it prints and
 * reads in greyscale. Pure: returns a string.
 */

const EDGE = { valid: '#1E6E47', warning: '#B86A00', error: '#B42318', unset: '#A6ADB5', neutral: '#5B6470' };
const WORD = { valid: 'OK', warning: 'Warning', error: 'Error', unset: 'Not set' };
const MARGIN = 24;
const TITLE_H = 56;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function text(x, y, value, { size = 12, weight = 400, mono = false, fill = '#1D232B' } = {}) {
    const family = mono ? "'IBM Plex Mono', ui-monospace, monospace" : "'IBM Plex Sans', system-ui, sans-serif";
    return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`;
}

function box(n, strokeColour) {
    const dash = n.placeholder ? ' stroke-dasharray="5 4"' : '';
    const fill = n.placeholder ? '#FAFAF8' : '#FFFFFF';
    return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="${fill}" stroke="${strokeColour}" stroke-width="1.5"${dash}/>`;
}

/** Lines of text for a node, top to bottom. */
function nodeLines(n) {
    switch (n.kind) {
        case 'array':
            return [
                { t: `${n.title}  (${n.status === 'unset' ? 'not checked' : WORD[n.status]})`, weight: 600, size: 13 },
                { t: n.panel || 'No panel yet' },
                { t: n.wiring || (n.next ? `Next: choose a ${n.next}` : ''), mono: true },
            ];
        case 'controller':
            return [
                { t: n.kicker || '', size: 10, weight: 600, fill: '#5B6470' },
                { t: n.title, weight: 600, size: 13 },
                ...(n.meter ? [{ t: `${Math.round(n.meter.value)} / ${Math.round(n.meter.max)} W (${Math.round((n.meter.value / n.meter.max) * 100)}%)`, mono: true }] : []),
                ...(n.micro ? [{ t: `${n.micro.units} micros · ${n.micro.perUnit} panel${n.micro.perUnit === 1 ? '' : 's'} each` }] : []),
                ...(n.status === 'warning' ? [{ t: 'Warning: power over the limit' }] : []),
            ];
        case 'freePort':
            return [{ t: n.title }];
        case 'slot':
            return [{ t: n.title }];
        case 'addArray':
            return [{ t: n.title, weight: 600 }];
        default:
            return [{ t: n.title, weight: 600, size: 13 }, { t: n.subtitle || '' }];
    }
}

/**
 * @param {ReturnType<import('./sldLayout').sldLayout>} layout
 * @param {{ title: string, subtitle?: string }} meta
 * @returns {string} SVG markup
 */
export function sldToSvg(layout, { title, subtitle = '' }) {
    const width = layout.width + MARGIN * 2;
    const height = layout.height + TITLE_H + MARGIN * 2;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
    out.push(`<rect width="100%" height="100%" fill="#FFFFFF"/>`);
    out.push(`<defs>${Object.entries(EDGE)
        .map(([k, c]) => `<marker id="arrow-${k}" orient="auto" markerWidth="6" markerHeight="6" refX="5" refY="3"><path d="M0 0 L6 3 L0 6 Z" fill="${c}"/></marker>`)
        .join('')}</defs>`);
    out.push(text(MARGIN, MARGIN + 18, title, { size: 18, weight: 600 }));
    if (subtitle) out.push(text(MARGIN, MARGIN + 38, subtitle, { size: 12, mono: true, fill: '#5B6470' }));
    out.push(`<g transform="translate(${MARGIN} ${MARGIN + TITLE_H})">`);
    for (const col of layout.columns) out.push(text(col.x, -8, col.label, { size: 10, weight: 600, fill: '#5B6470' }));

    for (const e of layout.edges) {
        const [[x1, y1], [x2, y2]] = e.points;
        const colour = EDGE[e.status] || EDGE.neutral;
        const dash = e.dashed ? ' stroke-dasharray="6 6"' : '';
        const arrow = e.arrow ? ` marker-end="url(#arrow-${e.status in EDGE ? e.status : 'neutral'})"` : '';
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="2"${dash}${arrow}/>`);
        if (e.chip) {
            const c = e.chip;
            out.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="5" fill="#FFFFFF" stroke="${colour}"/>`);
            c.lines.forEach((line, i) => {
                const word = i === 0 && e.status !== 'valid' ? `${WORD[e.status]}: ` : '';
                out.push(text(c.x + 8, c.y + 18 + i * 16, word + line.map((m) => m.text).join(' · '), { size: 11, mono: true }));
            });
        }
    }

    for (const n of layout.nodes) {
        const stroke = n.placeholder ? EDGE.unset : n.kind === 'output' || n.kind === 'controller' ? '#1D232B' : EDGE[n.status] || EDGE.neutral;
        out.push(box(n, stroke));
        nodeLines(n).forEach((line, i) => {
            if (line.t) out.push(text(n.x + 10, n.y + 20 + i * 17, line.t, { size: line.size || 11, weight: line.weight || 400, mono: line.mono, fill: line.fill }));
        });
        if (n.kind === 'controller') {
            for (const p of n.ports) {
                out.push(text(n.x + 10, n.y + p.y + 4, `MPPT ${p.port}  ${p.name || 'free'}`, { size: 11, mono: true }));
            }
            if (n.spec) out.push(text(n.x + 10, n.y + n.h - 12, n.spec, { size: 10, mono: true, fill: '#5B6470' }));
        }
    }
    out.push('</g>');
    out.push(text(MARGIN, height - 10, 'Dashed: not specified or not checked. Generated by Solar Pear; not an installation drawing.', { size: 10, fill: '#5B6470' }));
    out.push('</svg>');
    return out.join('\n');
}
