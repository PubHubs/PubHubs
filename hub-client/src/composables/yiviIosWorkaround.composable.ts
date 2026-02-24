// useYiviIosWorkaround.ts
import { onWatcherCleanup, watch } from 'vue';
import type { useTemplateRef } from 'vue';

import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Workaround for #1173, that iOS app links do not work in an iframe.
//
// NOTE: Please remove when e.g. https://github.com/privacybydesign/yivi-frontend-packages/pull/34 is merged (does not seem like it will be merged)
//
//
// Idea: we wait for the "Open Yivi app" anchor <a class="yivi-web-button-link" ...>
//       to be created using a MutationObserver, and add target="_top" attribute to it.
//
function useYiviIosWorkaround(yiviLoginRef: ReturnType<typeof useTemplateRef>) {
	function onYiviNodeChange() {
		LOGGER.trace(SMI.OTHER, "Changes to Yivi div's subtree");
		const yiviAnchor = yiviLoginRef.value?.querySelector('.yivi-web-button-link');
		if (!yiviAnchor) {
			LOGGER.trace(SMI.OTHER, "Yivi div changed, but no 'Open Yivi app' anchor was found.");
			return;
		}
		if (!yiviAnchor.hasAttribute('href')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' has no href attribute (yet)");
			return;
		}
		if (yiviAnchor.getAttribute('href')!.startsWith('intent')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' button uses intent link, so this is not iOS: not changing target");
			return;
		}
		if (yiviAnchor.hasAttribute('target')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' anchor's target was already set.");
			return;
		}
		LOGGER.info(SMI.OTHER, 'Setting target="_top" on \'Open Yivi app\' anchor.');
		yiviAnchor.setAttribute('target', '_top');
	}

	watch(yiviLoginRef, (yiviLoginEl) => {
		LOGGER.trace(SMI.OTHER, 'The Yivi div itself changed');
		const mutationObserver = new MutationObserver(onYiviNodeChange);
		LOGGER.trace(SMI.OTHER, 'Connecting MutationObserver to Yivi div for observing changes to its subtree');
		mutationObserver.observe(yiviLoginEl, {
			childList: true,
			subtree: true,
		});
		onWatcherCleanup(() => {
			LOGGER.trace(SMI.OTHER, 'Disconnecting Yivi div MutationObserver');
			mutationObserver.disconnect();
		});
	});
}

export { useYiviIosWorkaround };
