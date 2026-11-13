<template>
	<Dialog
		:buttons="buttons"
		:title="$t('settings.title')"
		type="global"
		@close="onClose"
	>
		<div class="flex flex-col gap-100">
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.theme') }}</Label>
				<ButtonGroup :combined="true">
					<Button
						v-for="option in settings.getThemeOptions(t)"
						:key="option.value"
						:variant="option.value === data.theme.value ? 'primary' : 'secondary'"
						size="sm"
						@click="updateData('theme', option.value)"
					>
						{{ option.label }}
					</Button>
				</ButtonGroup>
			</div>
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.language') }}</Label>
				<ButtonGroup :combined="true">
					<Button
						v-for="option in settings.getLanguageOptions ?? []"
						:key="option.value"
						:variant="option.value === data.language.value ? 'primary' : 'secondary'"
						size="sm"
						@click="updateData('language', option.value)"
					>
						{{ option.label }}
					</Button>
				</ButtonGroup>
			</div>
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.timeformat') }}</Label>
				<ButtonGroup :combined="true">
					<Button
						v-for="option in settings.getTimeFormatOptions(t)"
						:key="option.value"
						:variant="option.value === data.timeformat.value ? 'primary' : 'secondary'"
						size="sm"
						@click="updateData('timeformat', option.value)"
					>
						{{ option.label }}
					</Button>
				</ButtonGroup>
			</div>
			<div
				v-if="!useSettings().isNativeApp"
				class="flex flex-col justify-between md:flex-row"
			>
				<Label>{{ t('settings.notifications') }}</Label>
				<ButtonGroup
					v-if="notificationSupported"
					:combined="true"
				>
					<Button
						v-for="option in settings.getNotificationOptions(t)"
						:key="option.value"
						:variant="option.value === data.notifications.value ? 'primary' : 'secondary'"
						size="sm"
						@click="updateNotificationsPermission(option.value)"
					>
						{{ option.label }}
					</Button>
				</ButtonGroup>
				<p v-if="!notificationSupported">
					{{ $t('notifications.notSupported') }}
				</p>
			</div>
			<div
				v-if="(promptAllow || promptReset) && !useSettings().isNativeApp"
				class="flex"
			>
				<Icon
					class="mr-050 mt-[3px] shrink-0"
					size="sm"
					type="warning"
				/>
				<p
					v-if="promptAllow"
					class="italic"
				>
					{{ $t('notifications.promptAllow') }}
				</p>
				<p
					v-if="promptReset"
					class="italic"
				>
					{{ $t('notifications.promptReset') }}
				</p>
			</div>
			<div
				v-if="promptInfo && !useSettings().isNativeApp"
				class="flex"
			>
				<div class="mr-050 flex h-250 w-250 shrink-0 items-center justify-center rounded-full border-2">
					<Icon
						size="xs"
						type="info"
					/>
				</div>
				<p class="italic">
					{{ $t('notifications.info') }}
				</p>
			</div>
			<div
				v-if="installPromptStore.conditionsMet && !useSettings().isNativeApp"
				class="flex flex-col justify-between md:flex-row"
			>
				<Label>{{ $t('pwa.add_app') }}</Label>
				<Button
					class="w-fit"
					@click="installPromptStore.setShowPrompt(true)"
				>
					{{ $t('pwa.open_instructions') }}
				</Button>
			</div>
			<div class="border-surface-high mt-400 border-t pt-400">
				<Button
					class="mb-300 w-fit"
					icon="user-circle-minus"
					data-testid="delete-account"
					@click="goToDeleteAccount"
				>
					{{ $t('settings.go_to_delete_account_page') }}
				</Button>
			</div>
		</div>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { nextTick, onMounted, reactive, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { type FormDataType, useFormState } from '@hub-client/composables/useFormState';

	// Stores
	import { useInstallPromptStore } from '@global-client/stores/installPromptPWA';

	import { DialogButton, type DialogButtonAction, DialogOk, buttonsSubmitCancel } from '@hub-client/stores/dialog';
	import { NotificationsPermission, type Theme, type TimeFormat, useSettings } from '@hub-client/stores/settings';

	const { t } = useI18n();

	const { data, setSubmitButton, setData, updateData, dataIsChanged, changed } = useFormState();
	const settings = useSettings();
	const installPromptStore = useInstallPromptStore();
	const router = useRouter();
	const promptAllow = ref<boolean>(false);
	const promptReset = ref<boolean>(false);
	const promptInfo = ref<boolean>(false);
	const notificationSupported = 'Notification' in window;
	// Copies, since the submit button gets disabled and the shared constants are used by other dialogs as well
	const buttons = reactive(buttonsSubmitCancel.map((b) => new DialogButton(b.label, b.color, b.action)));

	setData({
		theme: { value: settings.getSetTheme as FormDataType },
		language: { value: settings.getActiveLanguage as FormDataType },
		timeformat: { value: settings.getTimeFormat as FormDataType },
		notifications: { value: settings.getNotificationsPermission as FormDataType },
	});

	/**
	 * Deleting the account has a page of its own, which the app stores link to; going there leaves
	 * this dialog, with the global bar it belongs to.  Unsaved settings are dropped, as on cancel.
	 */
	function goToDeleteAccount() {
		router.push({ name: 'delete-account' });
	}

	function updateNotificationsPermission(event: string) {
		promptAllow.value = false;
		promptReset.value = false;
		if (event === NotificationsPermission.Allow) {
			if (Notification.permission === 'default') promptInfo.value = true;
			Notification.requestPermission().then((result) => {
				promptInfo.value = false;
				if (result === 'granted') {
					data.notifications.value = NotificationsPermission.Allow;
					settings.setNotificationPermission(NotificationsPermission.Allow);
				} else {
					data.notifications.value = NotificationsPermission.Deny;
					settings.setNotificationPermission(NotificationsPermission.Deny);
					promptAllow.value = true;
				}
			});
		} else if (event === NotificationsPermission.Deny) {
			if (Notification.permission === 'granted') {
				nextTick(() => {
					data.notifications.value = NotificationsPermission.Allow;
					settings.setNotificationPermission(NotificationsPermission.Allow);
					promptReset.value = true;
				});
			}
		}
	}

	onMounted(() => {
		// Watch for changes in the permission for notifications by the user to reflect these changes in the settings dialog
		if ('permissions' in navigator) {
			navigator.permissions.query({ name: 'notifications' }).then(function (notificationPerm) {
				notificationPerm.onchange = function () {
					if (notificationPerm.state === 'prompt') {
						data.notifications.value = NotificationsPermission.Deny;
						settings.setNotificationPermission(NotificationsPermission.Deny);
						promptReset.value = false;
						promptAllow.value = false;
					}
				};
			});
		}

		setSubmitButton(buttons[0]);
	});

	function onClose(action: DialogButtonAction) {
		if (action !== DialogOk || !changed.value) return;

		let sendSettings = false;
		if (dataIsChanged('theme')) {
			settings.setTheme(data.theme.value as Theme);
			sendSettings = true;
		}
		if (dataIsChanged('language')) {
			settings.setLanguage(data.language.value as string);
			sendSettings = true;
		}
		if (dataIsChanged('timeformat')) {
			settings.setTimeFormat(data.timeformat.value as TimeFormat);
			sendSettings = true;
		}
		if (sendSettings) {
			settings.sendSettings();
		}
	}
</script>
