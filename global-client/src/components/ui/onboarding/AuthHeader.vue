<template>
	<div class="bg-surface flex h-[80px] w-full items-center px-6 py-4">
		<div class="flex h-full w-full items-center justify-between gap-16">
			<a
				class="h-full py-2"
				:href="globalClientUrl"
				rel="noopener noreferrer"
			>
				<Logo />
			</a>
			<div class="flex h-4 items-center justify-center gap-2">
				<p
					v-if="settings.language === 'nl'"
					class="hover:text-accent-primary cursor-pointer font-bold"
					@click="changeLanguage('en')"
				>
					EN
				</p>
				<p
					v-else
					class="hover:text-accent-primary cursor-pointer font-bold"
					@click="changeLanguage('nl')"
				>
					NL
				</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Logo from '@global-client/components/ui/Logo.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const globalClientUrl: string = _env.PUBHUBS_URL;

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}
</script>
