import { createContext, useContext } from 'react';

/** Which UI is showing: 'old' (classic) or 'next' (the phase 13 shell). Views that differ read this. */
export const UiModeContext = createContext('old');

export const useUiMode = () => useContext(UiModeContext);
