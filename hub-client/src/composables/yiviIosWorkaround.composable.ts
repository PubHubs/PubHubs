// useYiviIosWorkaround.ts
import { onWatcherCleanup, watch } from 'vue';
import type { useTemplateRef } from 'vue';

import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('Other');

// Workaround for #1173, that iOS app links do not work in an iframe.
//
// NOTE: Please remove when e.g. https://github.com/privacybydesign/yivi-frontend-packages/pull/34 is merged (does not seem like it will be merged)
//
//
// Idea: we wait for the "Open Yivi app" anchor <a class="yivi-web-button-link" ...>
//       to be created using a MutationObserver, and add target="_top" attribute to it.
//
function useYiviIosWorkaround(yiviLoginRef: ReturnType<typeof useTemplateRef<Element>>) {
	function onYiviNodeChange() {
		logger.debug("Changes to Yivi div's subtree");
		const yiviAnchor = (yiviLoginRef.value as Element | null)?.querySelector('.yivi-web-button-link');
		if (!yiviAnchor) {
			logger.debug("Yivi div changed, but no 'Open Yivi app' anchor was found.");
			return;
		}
		if (!yiviAnchor.hasAttribute('href')) {
			logger.debug("'Open Yivi app' has no href attribute (yet)");
			return;
		}
		if (yiviAnchor.getAttribute('href')?.startsWith('intent')) {
			logger.debug("'Open Yivi app' button uses intent link, so this is not iOS: not changing target");
			return;
		}
		if (yiviAnchor.hasAttribute('target')) {
			logger.debug("'Open Yivi app' anchor's target was already set.");
			return;
		}
		logger.info('Setting target="_top" on \'Open Yivi app\' anchor.');
		yiviAnchor.setAttribute('target', '_top');
	}

	watch(yiviLoginRef, (yiviLoginEl) => {
		logger.debug('The Yivi div itself changed');
		const mutationObserver = new MutationObserver(onYiviNodeChange);
		logger.debug('Connecting MutationObserver to Yivi div for observing changes to its subtree');
		mutationObserver.observe(yiviLoginEl as Node, {
			childList: true,
			subtree: true,
		});
		onWatcherCleanup(() => {
			logger.debug('Disconnecting Yivi div MutationObserver');
			mutationObserver.disconnect();
		});
	});
}

export { useYiviIosWorkaround };
