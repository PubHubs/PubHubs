<template>
	<div class="hidden md:flex items-center">
		<input
			class="w-full md:pr-8 py-1 border-none rounded-md bg-gray-lighter placeholder:text-black dark:bg-gray-darker dark:text-white dark:placeholder:text-gray-light focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
			type="text"
			v-model="value"
			:placeholder="$t('others.search')"
			:title="$t('others.search')"
			@keydown="changed()"
			@keydown.enter="submit()"
			@keydown.esc="cancel()"
		/>
		<Icon class="-ml-6 search-icon dark:text-gray-light -scale-100 -rotate-90" type="search" size="sm" @click="submit()"></Icon>
	</div>

	<!-- Mobile version of the input field will be shwon instead of the above one on smaller screens. -->
	<div class="md:hidden h-full w-full flex justify-end items-end absolute pr-2 bottom-2">
		<div class="flex gap-4 w-[35px] rounded-md focus-within:w-full focus-within:bg-hub-background-4 focus-within:dark:bg-hub-background-3 transition-all duration-200 justify-end relative items-center max-w-full overflow-hidden">
			<input
				class="h-10 flex-1 w-full placeholder:text-black dark:text-white dark:placeholder:text-gray-light bg-transparent border-none focus:outline-0 focus:outline-offset-0 focus:ring-0"
				type="text"
				v-model="value"
				:placeholder="$t('others.search')"
				:title="$t('others.search')"
				@keydown="changed()"
				@keydown.enter="submit()"
				@keydown.esc="cancel()"
			/>
			<button class="dark:text-gray-lighter px-1 rounded-full bg-hub-background-4 dark:bg-gray-darker flex justify-center items-center aspect-[1]">
				<Icon class="search-icon -scale-100 -rotate-90 px-1" type="search" size="md"></Icon>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

	const emit = defineEmits(usedEvents);
	const { value, changed, submit, cancel } = useFormInputEvents(emit);
</script>
