<template>
	<div class="flex h-full items-center justify-center p-500">
		<div
			class="bg-surface-base flex flex-col gap-y-300 rounded-xl px-400 py-600 shadow-lg"
			:class="isMobile ? 'w-full' : 'w-8/12 max-w-[720px]'"
		>
			<H1>{{ $t('settings.deactivate_account') }}</H1>
			<p
				v-if="deactivated"
				data-testid="hub-account-deactivated"
			>
				{{ $t('settings.deactivate_account_done') }}
			</p>
			<template v-else>
				<p>{{ $t('settings.deactivate_account_page_intro') }}</p>
				<p>{{ $t('settings.deactivate_account_confirm_content') }}</p>

				<div class="flex flex-row justify-between px-400">
					<Button
						class="text-accent-primary w-fit"
						data-testid="deactivate-account-back"
						@click="goBack"
					>
						{{ $t('settings.deactivate_account_page_back') }}
					</Button>
					<Button
						class="w-fit"
						data-testid="deactivate-account"
						:disabled="deactivationPending"
						icon="user-circle-minus"
						variant="error"
						@click="deactivateAccount"
					>
						{{ $t('settings.deactivate_account') }}
					</Button>
				</div>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
	/**
	 * A page of its own for deactivating the user's account at this hub, like the global client's
	 * page for deleting the PubHubs account. Only this hub's account goes: the PubHubs account and
	 * the accounts at other hubs stay.
	 */
	// Packages
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { DialogYes, useDialog } from '@hub-client/stores/dialog';
	import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';

	const { t } = useI18n();
	const dialog = useDialog();
	const messagebox = useMessageBox();
	const pubhubs = usePubhubsStore();
	const router = useRouter();
	const settings = useSettings();

	const logger = createLogger('DeleteHubAccount');

	const isMobile = computed(() => settings.isMobileState);

	const deactivated = ref<boolean>(false);
	const deactivationPending = ref<boolean>(false);

	// Inside the global client the deactivation is done there, as only it can get PubHubs central to
	// vouch for the user's pseudonym at this hub; it answers with the result.
	onMounted(() => {
		messagebox.addCallback('parentFrame', MessageType.DeactivationResult, (message: Message) => {
			const { success, error } = message.content as { success: boolean; error?: string };
			if (success) {
				finishDeactivation();
			} else {
				deactivationPending.value = false;
				logger.error('Deactivation failed:', error);
				dialog.showError(t('settings.deactivate_account_error'));
			}
		});
	});

	onUnmounted(() => {
		messagebox.removeCallback('parentFrame', MessageType.DeactivationResult);
	});

	/** Deactivate this hub's account once the user confirms. */
	const deactivateAccount = async () => {
		const confirmed = await dialog.yesno(t('settings.deactivate_account_confirm_title'), t('settings.deactivate_account_confirm_content'));
		if (confirmed !== DialogYes) return;

		// The hub only deactivates for good with proof of the user's pseudonym, which only the global
		// client can obtain from PubHubs Central. Matrix's own deactivation would leave the pseudonym
		// linked to the erased account, locking the user out of this hub instead of starting afresh.
		if (!messagebox.isConnected) {
			dialog.showError(t('settings.deactivate_account_needs_global_client'));
			return;
		}

		const accessToken = pubhubs.Auth.getAccessToken();
		if (!accessToken) {
			logger.error('No access token available for deactivation');
			dialog.showError(t('settings.deactivate_account_error'));
			return;
		}

		deactivationPending.value = true;
		messagebox.sendMessage(new Message(MessageType.RequestDeactivation, { accessToken }));
	};

	/**
	 * The account is gone, so the session with it is too. Logging out reloads the hub client; inside
	 * the global client the hub is unpinned and left as well. Until then, the page says it worked.
	 */
	const finishDeactivation = () => {
		deactivated.value = true;
		deactivationPending.value = false;
		pubhubs.logout();
	};

	/**
	 * Back to where the user was in the hub before coming here, or to the hub's home page when this
	 * page is where they came in, as after a refresh. The router keeps the previous path in the
	 * history state.
	 */
	const goBack = () => {
		const back: unknown = window.history.state?.back;
		const cameFrom = typeof back === 'string' ? router.resolve(back).name : undefined;
		if (cameFrom && cameFrom !== 'delete-hub-account') {
			router.back();
		} else {
			router.push({ name: 'home' });
		}
	};
</script>
