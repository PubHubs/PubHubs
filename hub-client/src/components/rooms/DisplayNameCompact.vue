<template>
	<span
		class="gap-050 flex items-center"
		:title="pseudonym"
	>
		<span v-if="userDisplayName">{{ userDisplayName }}</span>
		<span>{{ pseudonym }}</span>
	</span>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	interface Props {
		userId: string;
		userDisplayName?: string | undefined;
	}
	const props = defineProps<Props>();

	// get Pseudonym
	const pseudonym = computed(() => {
		return filters.extractPseudonym(props.userId);
	});
</script>
