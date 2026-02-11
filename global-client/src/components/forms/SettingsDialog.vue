<template>
	<Dialog :title="$t('settings.title')" :buttons="buttonsSubmitCancel" type="global">
		<div class="flex flex-col gap-2">
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.theme') }}</Label>
				<ButtonGroup size="sm" v-model="data.theme.value" :value="data.theme.value" :options="settings.getThemeOptions(t)" @changed="updateData('theme', $event)" />
			</div>
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.language') }}</Label>
				<ButtonGroup size="sm" v-model="data.language.value" :value="data.language.value" :options="settings.getLanguageOptions" @changed="updateData('language', $event)" />
			</div>
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.timeformat') }}</Label>
				<ButtonGroup size="sm" v-model="data.timeformat.value" :value="data.timeformat.value" :options="settings.getTimeFormatOptions(t)" @changed="updateData('timeformat', $event)" />
			</div>
			<div class="flex flex-col justify-between md:flex-row">
				<Label>{{ t('settings.notifications') }}</Label>
				<ButtonGroup v-if="notificationSupported" size="sm" v-model="data.notifications.value" :value="data.notifications.value" :options="settings.getNotificationOptions(t)" @changed="updateNotificationsPermission($event)" />
				<p v-if="!notificationSupported">{{ $t('notifications.notSupported') }}</p>
			</div>
			<div v-if="promptAllow || promptReset" class="flex">
				<Icon type="warning" size="sm" class="mt-[3px] mr-1 shrink-0" />
				<p v-if="promptAllow" class="italic">{{ $t('notifications.promptAllow') }}</p>
				<p v-if="promptReset" class="italic">{{ $t('notifications.promptReset') }}</p>
			</div>
			<div v-if="promptInfo" class="flex">
				<div class="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2">
					<Icon type="info" size="xs" />
				</div>
				<p class="italic">{{ $t('notifications.info') }}</p>
			</div>
			<div v-if="installPromptStore.conditionsMet" class="flex flex-col justify-between md:flex-row">
				<Label>{{ $t('pwa.add_app') }}</Label>
				<Button class="w-fit" @click="installPromptStore.setShowPrompt(true)">{{ $t('pwa.open_instructions') }}</Button>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import ButtonGroup from '@hub-client/components/forms/ButtonGroup.vue';
	import Label from '@hub-client/components/forms/Label.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { FormDataType, useFormState } from '@hub-client/composables/useFormState';

	// Stores
	import { useInstallPromptStore } from '@global-client/stores/installPromptPWA';

	import { DialogOk, buttonsSubmitCancel, useDialog } from '@hub-client/stores/dialog';
	import { NotificationsPermission, Theme, TimeFormat, useSettings } from '@hub-client/stores/settings';

	const { t } = useI18n();

	const { data, setSubmitButton, setData, updateData, dataIsChanged, changed } = useFormState();
	const settings = useSettings();
	const dialog = useDialog();
	const installPromptStore = useInstallPromptStore();
	const promptAllow = ref<boolean>(false);
	const promptReset = ref<boolean>(false);
	const promptInfo = ref<boolean>(false);
	const notificationSupported = 'Notification' in window;

	setData({
		theme: { value: settings.getSetTheme as FormDataType },
		language: { value: settings.getActiveLanguage as FormDataType },
		timeformat: { value: settings.getTimeFormat as FormDataType },
		notifications: { value: settings.getNotificationsPermission as FormDataType },
	});

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

		dialog.addCallback(DialogOk, () => {
			if (changed) {
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
		});
		setSubmitButton(dialog.properties.buttons[0]);
	});
</script>
