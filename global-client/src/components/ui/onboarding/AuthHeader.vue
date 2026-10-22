<template>
	<div class="bg-surface border-surface-elevated flex h-[80px] w-full items-center border-b-3 px-300 py-200">
		<div class="flex h-full w-full items-center justify-between gap-800">
			<router-link
				class="h-full py-100"
				:to="{ name: 'login' }"
			>
				<Logo />
			</router-link>
			<div class="flex h-200 items-center justify-center gap-300">
				<p
					v-if="reviewMode"
					class="text-accent-primary flex items-center gap-100 font-bold"
				>
					{{ $t('review_mode.label') }}
					<button
						class="cursor-pointer underline"
						@click="switchReviewMode(false, '/login')"
					>
						{{ $t('review_mode.leave') }}
					</button>
				</p>
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

	// Logic
	import { inReviewMode, switchReviewMode } from '@global-client/logic/reviewMode';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	// Shown on the login and register pages, so a reviewer (or anyone who ended up here) can switch back.
	const reviewMode = inReviewMode();

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}
</script>
