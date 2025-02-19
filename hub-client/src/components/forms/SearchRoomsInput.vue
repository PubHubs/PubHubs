<template>
	<div class="relative flex items-center">
		<input
			class="w-full min-w-48 rounded-md border-none bg-hub-background-3 py-2 text-hub-text placeholder:text-gray focus:ring-0 md:pr-8"
			type="search"
			v-model="inputValue"
			:placeholder="$t('others.search')"
			:title="$t('others.search')"
			aria-describedby="$t('others.search_room')"
			@input="updateSearchTerm()"
		/>
		<Icon class="-ml-6 hover:cursor-pointer" type="search" size="sm"></Icon>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { ref } from 'vue';

	const emit = defineEmits(['update-search-term']);
	const inputValue = ref('');

	function updateSearchTerm() {
		emit('update-search-term', inputValue.value);
	}
</script>
