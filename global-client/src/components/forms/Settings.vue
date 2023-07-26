<template>
	<div class="flex flex-col">
		<div class="flex justify-between mb-2">
			<label>{{ t('settings.theme') }}</label>
			<ButtonGroup size="sm" v-model="data.theme" :value="data.theme" :options="settings.getThemeOptions(t)" @changed="updateData('theme', $event)"></ButtonGroup>
		</div>
		<div class="flex justify-between mb-2">
			<label>{{ t('settings.language') }}</label>
			<ButtonGroup size="sm" v-model="data.language" :value="data.language" :options="settings.getLanguageOptions" @changed="updateData('language', $event)"></ButtonGroup>
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

	setData({
		theme: settings.getSetTheme as FormDataType,
		language: settings.getActiveLanguage as FormDataType,
	});

	onMounted(() => {
		dialog.addCallback(DialogTrue, () => {
			if (changed) {
				let sendSettings = false;
				if (dataIsChanged('theme')) {
					settings.setTheme(data.theme as Theme);
					sendSettings = true;
				}
				if (dataIsChanged('language')) {
					settings.setLanguage(data.language as string);
					sendSettings = true;
				}
				if (sendSettings) {
					settings.sendSettings();
				}
			}
		});
	});
</script>
