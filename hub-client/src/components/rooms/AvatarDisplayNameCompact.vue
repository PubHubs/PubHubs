<template>
	<span class="flex items-center gap-1" :title="pseudonym">
		<Icon type="user-circle"></Icon>
		<DisplayNameCompact :userId="userId" :userDisplayName="userDisplayName"></DisplayNameCompact>
	</span>
</template>

<script setup lang="ts">
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
