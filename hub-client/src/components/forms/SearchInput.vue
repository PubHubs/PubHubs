<template>
	<div class="relative">
		<input
			class="w-full h-8 pl-2 pr-6 py-1 truncate border rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
			type="text"
			v-model="value"
			:placeholder="$t('others.search')"
			:title="$t('others.search')"
			@keydown="changed()"
			@keydown.enter="submit()"
			@keydown.esc="cancel()"
		/>
		<Icon class="absolute right-2 top-2 search-icon dark:text-white float-right" type="search" size="sm" @click="submit()"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

	const emit = defineEmits(usedEvents);
	const { value, changed, submit, cancel } = useFormInputEvents(emit);
</script>
