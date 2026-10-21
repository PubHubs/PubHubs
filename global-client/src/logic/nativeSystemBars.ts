// Packages
import { registerPlugin } from '@capacitor/core';

// Types
type SystemBarColorPlugin = {
	setColor: (options: { color: string }) => Promise<void>;
};

/**
 * Colours the Android status bar and navigation bar through our own plugin.
 *
 * Neither Capacitor plugin can do this on Android 15 and later, where the bars are transparent and
 * show whatever is behind them. See SystemBarColorPlugin.java.
 */
const SystemBarColor = registerPlugin<SystemBarColorPlugin>('SystemBarColor');

/**
 * @param color the colour as '#rrggbb'
 */
const setSystemBarColorNatively = async (color: string): Promise<void> => {
	await SystemBarColor.setColor({ color });
};

export { setSystemBarColorNatively };
