<template>
	<span
		class="flex items-center gap-1"
		:title="pseudonym"
	>
		<Icon
			type="user-circle"
			size="sm"
		/>
		<DisplayNameCompact
			:user-display-name="userDisplayName"
			:user-id="userId"
		/>
	</span>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	// Components
	import DisplayNameCompact from '@hub-client/components/rooms/DisplayNameCompact.vue';

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
