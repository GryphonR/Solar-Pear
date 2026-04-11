import { PANEL_SERIES_SHARED_FIELDS, panelSeriesKey } from "../../lib/panelSeriesShared.mjs";

export { PANEL_SERIES_SHARED_FIELDS };

export function panelSeriesKeyFromRow(row) {
    return panelSeriesKey(row);
}
