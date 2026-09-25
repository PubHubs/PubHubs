// Packages
import { useI18n } from 'vue-i18n';

// Stores
import { type PinnedHub, useGlobal } from '@global-client/stores/global';

import { useDialog } from '@hub-client/stores/dialog';
import { useMessageBox } from '@hub-client/stores/messagebox';

/**
 * Pinning and unpinning hubs outside of the drag-and-drop in the hub menu.
 */
const usePinnedHubs = () => {
	const global = useGlobal();
	const dialog = useDialog();
	const { t } = useI18n();

	/**
	 * Pin a hub without entering it. It goes to the top of the menu, like a hub pinned by entering it.
	 */
	const pinHub = (hub: PinnedHub) => {
		if (global.existsInPinnedHubs(hub.hubId)) return;
		global.addPinnedHub(hub, 0);
	};

	/**
	 * Unpin a hub after the user confirms.
	 *
	 * @returns whether the hub was unpinned
	 */
	const unpinHub = async (hubId: string): Promise<boolean> => {
		const confirmed = Boolean(await dialog.yesno(t('dialog.hub_unpin_title'), t('dialog.hub_unpin_context'), 'global'));
		if (!confirmed) return false;
		const index = global.pinnedHubs.findIndex((pinnedHub) => pinnedHub.hubId === hubId);
		if (index < 0) return false;
		global.removePinnedHub(index);
		// Stop listening to the hub's miniclient, which goes away with the pin.
		useMessageBox().resetMiniclient(hubId);
		return true;
	};

	return { pinHub, unpinHub };
};

export { usePinnedHubs };
