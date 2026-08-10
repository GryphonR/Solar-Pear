import { PANEL_SERIES_SHARED_FIELDS, NO_SERIES_KEY, panelSeriesKey } from "../../lib/panelSeriesShared.mjs";

export { PANEL_SERIES_SHARED_FIELDS, NO_SERIES_KEY };

export function panelSeriesKeyFromRow(row) {
    return panelSeriesKey(row);
}
