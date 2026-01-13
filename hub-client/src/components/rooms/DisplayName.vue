<template>
	<span class="truncate" :title="displayname" :class="`${textColor(color(user?.userId))}`">{{ displayname }}</span>
	<span class="text-label-small mt-1 text-nowrap">{{ filters.extractPseudonym(user?.userId) }}</span>
</template>

<script setup lang="ts">
	// Packages
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { computed } from 'vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const { color, textColor } = useUserColor();

	const pubhubs = usePubhubsStore();

	const user = computed(getMatrixUser);
	const displayname = computed(getDisplayName);

	const props = defineProps({
		userId: {
			type: String,
			required: true,
		},
	});

	function getMatrixUser(): MatrixUser | undefined {
		if (pubhubs.client.getUser) {
			return pubhubs.client.getUser(props.userId)!;
		}
		return undefined;
	}

	function getDisplayName(): string {
		if (!user.value) return '';
		return user.value.displayName as string;
	}
</script>
