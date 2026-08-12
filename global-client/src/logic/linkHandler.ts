// Packages
import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core';

// Types
type ExternalAppMissingEvent = {
	url: string;
};

type LinkHandlerPlugin = {
	addListener: (eventName: 'externalAppMissing', listenerFunc: (event: ExternalAppMissingEvent) => void) => Promise<PluginListenerHandle>;
};

const LinkHandler = registerPlugin<LinkHandlerPlugin>('LinkHandler');

/**
 * Listens for Yivi links the OS could not open, which happens when the Yivi app
 * is not installed. Without this the tap is simply swallowed by Capacitor, so the
 * caller is expected to surface the failure to the user.
 *
 * Resolves to a cleanup function; a no-op outside the native app, where the
 * browser reports an unopenable link itself.
 *
 * @param handler receives the url that could not be opened
 */
const onExternalAppMissing = async (handler: (url: string) => void): Promise<() => void> => {
	if (!Capacitor.isNativePlatform()) return () => {};

	const listener = await LinkHandler.addListener('externalAppMissing', ({ url }) => handler(url));

	return () => {
		listener.remove();
	};
};

export { onExternalAppMissing };
