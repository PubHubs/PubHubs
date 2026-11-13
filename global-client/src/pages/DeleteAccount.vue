<template>
	<div class="flex h-full items-center justify-center p-500">
		<div
			class="bg-surface-base flex flex-col gap-y-300 rounded-xl px-400 py-600 shadow-lg"
			:class="isMobile ? 'w-full' : 'w-8/12 max-w-[720px]'"
		>
			<H1>{{ $t('settings.delete_account') }}</H1>
			<p
				v-if="deleted"
				data-testid="account-deleted"
			>
				{{ $t('settings.delete_account_done') }}
			</p>
			<template v-else>
				<p>{{ $t('settings.delete_account_page_intro') }}</p>
				<p>{{ $t('settings.delete_account_confirm_content') }}</p>
			</template>

			<template v-if="!deleted && global.loggedIn">
				<div class="flex flex-row justify-between px-400">
					<Button
						class="text-accent-primary w-fit"
						data-testid="delete-account-back"
						@click="goBack"
					>
						{{ $t('settings.delete_account_page_back') }}</Button
					>
					<Button
						class="w-fit"
						icon="user-circle-minus"
						:disabled="deletionPending"
						data-testid="delete-account"
						variant="error"
						@click="deleteAccount"
					>
						{{ $t('settings.delete_account') }}
					</Button>
				</div>
			</template>
			<template v-else-if="!deleted">
				<p>{{ $t('settings.delete_account_page_login_first') }}</p>
				<Button
					class="w-fit"
					data-testid="login-to-delete-account"
					@click="logIn"
				>
					{{ $t('settings.delete_account_page_login') }}
				</Button>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
	/**
	 * A page of its own for deleting the PubHubs account, so it has a link: the app stores ask for
	 * one, to a page where users can delete their account without installing the app.
	 *
	 * Open to everyone, so whoever follows the link learns what deleting means before logging in.
	 */
	// Packages
	import { computed, ref } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';

	// Composables
	import { useAccountDeletion } from '@global-client/composables/accountDeletion.composable';

	// Stores
	import { useGlobal } from '@global-client/stores/global';

	import { useSettings } from '@hub-client/stores/settings';

	const global = useGlobal();
	const router = useRouter();
	const settings = useSettings();
	const { confirmAndDeleteAccount, deletionPending } = useAccountDeletion();

	const isMobile = computed(() => settings.isMobileState);

	const deleted = ref<boolean>(false);

	/** Logging out does not leave this page, as it needs no login, so we say it worked here. */
	const deleteAccount = async () => {
		deleted.value = await confirmAndDeleteAccount();
	};

	/**
	 * Back to where the user was in the app before coming here, or to the hubs overview when this page
	 * is where they came in, as from the app stores' link.  The router keeps the previous in-app path
	 * in the history state; outside the app there is none.  Coming back here from logging in, the
	 * page before is this one, logged out, or the login page: going back would seem to do nothing.
	 */
	const goBack = () => {
		const back: unknown = window.history.state?.back;
		const cameFrom = typeof back === 'string' ? router.resolve(back).name : undefined;
		if (cameFrom && cameFrom !== 'delete-account' && cameFrom !== 'login') {
			router.back();
		} else {
			router.push({ name: 'hubs-overview' });
		}
	};

	/** Logging in brings the user back here, to the delete button. */
	const logIn = () => router.push({ name: 'login', query: { redirect: '/delete-account' } });
</script>
