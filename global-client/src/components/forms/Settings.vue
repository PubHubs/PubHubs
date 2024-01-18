<template>
	<div class="flex flex-col">
		<div class="flex flex-col md:flex-row justify-between mb-2">
			<Label>{{ t('settings.theme') }}</Label>
			<ButtonGroup size="sm" v-model="data.theme.value" :value="data.theme.value" :options="settings.getThemeOptions(t)" @changed="updateData('theme', $event)"></ButtonGroup>
		</div>
		<div class="flex flex-col md:flex-row justify-between mb-2">
			<Label>{{ t('settings.language') }}</Label>
			<ButtonGroup size="sm" v-model="data.language.value" :value="data.language.value" :options="settings.getLanguageOptions" @changed="updateData('language', $event)"></ButtonGroup>
		</div>
		<div v-if="noPerm()" class="flex flex-col md:flex-row justify-between mb-2">
			<label>{{ t('settings.notifications') }}</label>
			<Button @click="askPerm()">{{ t('settings.notifications_allow') }}</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useSettings, Theme } from '@/store/store';
	import { useFormState, FormDataType } from '@/composables/useFormState';
	import { useDialog, DialogTrue } from '@/store/store';

	import { useI18n } from 'vue-i18n';
	const { t } = useI18n();

	const { data, setData, updateData, dataIsChanged, changed } = useFormState();
	const settings = useSettings();
	const dialog = useDialog();

	function noPerm() {
		return Notification.permission === 'denied' || Notification.permission === 'default';
	}

	function askPerm() {
		Notification.requestPermission().then((result) => {
			console.debug(result);
		});
	}

	setData({
		theme: { value: settings.getSetTheme as FormDataType },
		language: { value: settings.getActiveLanguage as FormDataType },
	});

	onMounted(() => {
		dialog.addCallback(DialogTrue, () => {
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
				if (sendSettings) {
					settings.sendSettings();
				}
			}
		});
	});
</script>
