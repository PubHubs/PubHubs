<template>
	<span class="flex items-center gap-1" :title="pseudonym">
		<Icon type="user-circle"></Icon>
		<span v-if="userDisplayName">{{ userDisplayName }}</span>
		<span>{{ pseudonym }}</span>
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

	const props = withDefaults(defineProps<Props>(), {
		userDisplayName: undefined,
	});

	// get Pseudonym
	const pseudonym = computed(() => {
		return filters.extractPseudonym(props.userId);
	});
</script>
