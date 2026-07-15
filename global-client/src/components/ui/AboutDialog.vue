<template>
	<Dialog
		:buttons="[]"
		:title="t('about.title')"
		type="global"
	>
		<div class="flex flex-col items-center gap-300 py-200 text-center">
			<div class="h-600 w-full">
				<Logo />
			</div>
			<div class="gap-050 flex flex-col">
				<span class="font-headings text-h3 font-semibold">{{ t('common.app_name') }}</span>
				<span class="text-on-surface-dim text-label">{{ t('about.version', [version]) }}</span>
			</div>
			<P>{{ t('about.description') }}</P>
			<Button @click="gotoHelp">{{ t('about.help_button') }}</Button>
		</div>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import Logo from '@global-client/components/ui/Logo.vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import P from '@hub-client/components/elements/P.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const { t } = useI18n();
	const settings = useSettings();

	// Injected from package.json at build time (see vite.config.ts).
	const version = __APP_VERSION__;

	function gotoHelp() {
		const lang = settings.getActiveLanguage;
		window.open(`https://www.pubhubs.net/${lang}/help/`, '_blank');
	}
</script>
