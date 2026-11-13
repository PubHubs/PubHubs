// Packages
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useMSS } from '@global-client/stores/mss';

import { DialogYes, useDialog } from '@hub-client/stores/dialog';

const logger = createLogger('accountDeletion');

/** Whether the account was deleted, and if not, why. */
type DeleteAccountResult = { deleted: true } | { deleted: false; reason: 'Banned' | 'Failed' };

/**
 * Deleting the user's PubHubs account, hub accounts and all.
 *
 * Deleting the account releases the attributes it was registered with, so registering with the
 * same attributes again yields a different account - and therefore a different pseudonym at
 * every hub. Nothing of the old account carries over.
 */
const useAccountDeletion = () => {
	const global = useGlobal();
	const mss = useMSS();
	const dialog = useDialog();
	const { t } = useI18n();

	const deletionPending = ref<boolean>(false);

	/**
	 * Delete the user's PubHubs account, which deactivates their accounts at the hubs as well.
	 *
	 * The hubs are not contacted from here: PubHubs central lists the user's pseudonym at every
	 * hub as deleted, and each hub deactivates its account when it next asks. That reaches the
	 * hubs the user unpinned, and hubs that are offline right now, which we could not.
	 */
	const deleteAccount = async (): Promise<DeleteAccountResult> => {
		const deleteResp = await mss.phcServer.deleteAccountEP();

		if (deleteResp === 'Banned') {
			return { deleted: false, reason: 'Banned' };
		}
		if (deleteResp !== 'Deleted') {
			logger.error(`Account deletion did not go through: ${deleteResp}`);
			return { deleted: false, reason: 'Failed' };
		}

		await global.logout({ key: 'settings.delete_account_done' });

		return { deleted: true };
	};

	/** What to tell the user when `deleteAccount` did not delete anything. */
	const deleteAccountErrorMessage = (result: Extract<DeleteAccountResult, { deleted: false }>): string => {
		if (result.reason === 'Banned') return t('settings.delete_account_banned');
		return t('settings.delete_account_error');
	};

	/**
	 * Delete the account after the user confirms, as the delete buttons do.
	 *
	 * A failure is reported here.  A success logs the user out, which takes them to the login page
	 * with a message - but only from a page that needs a login: elsewhere the caller tells them,
	 * which is what the returned `true` is for.
	 */
	const confirmAndDeleteAccount = async (): Promise<boolean> => {
		const confirmed = await dialog.yesno(t('settings.delete_account_confirm_title'), t('settings.delete_account_confirm_content'), 'global');
		if (confirmed !== DialogYes) return false;

		deletionPending.value = true;
		try {
			const result = await deleteAccount();
			if (!result.deleted) {
				await dialog.showError(t('settings.delete_account'), deleteAccountErrorMessage(result), 'global');
			}
			return result.deleted;
		} finally {
			deletionPending.value = false;
		}
	};

	return { confirmAndDeleteAccount, deleteAccount, deleteAccountErrorMessage, deletionPending };
};

export { useAccountDeletion, type DeleteAccountResult };
