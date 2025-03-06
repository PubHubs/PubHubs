<template>
	<div class="flex h-full items-center justify-center p-10 dark:text-white">
		<div class="text-center">
			<h1 class="mb-8 text-6xl font-bold">{{ $t('errors.oops') }}</h1>
			<h2 class="mb-4 text-2xl font-semibold">{{ $t('rooms.access_denied') }}</h2>
			<p class="mb-4 text-lg">{{ $t('rooms.secured_room_error') }}</p>
			<router-link :to="{ name: 'home' }"
				><Button>{{ $t('dialog.go_back') }}</Button></router-link
			>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Button from '@/components/elements/Button.vue';
</script>
