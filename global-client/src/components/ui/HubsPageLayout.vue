<template>
	<div class="flex max-h-screen flex-col overflow-y-auto">
		<PageHeader
			:icon="icon"
			:title="title"
		/>
		<div class="mx-auto mb-800 flex w-full flex-col items-center gap-500 px-400 md:w-4/6 md:px-0">
			<slot />
		</div>
		<InstallPrompt
			:browser="device.getBrowserName()"
			:operating-system="device.getMobileOS()"
		/>
	</div>
</template>

<script setup lang="ts">
	// Components
	import InstallPrompt from '@global-client/components/ui/InstallPrompt.vue';
	import PageHeader from '@global-client/components/ui/PageHeader.vue';

	// Logic
	import device from '@hub-client/logic/core/device';

	defineProps<{
		icon: string;
		title: string;
	}>();
</script>
