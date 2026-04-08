<template>
	<span
		class="truncate"
		:class="`${textColor(color(user?.userId ?? ''))}`"
		:title="displayname"
		>{{ displayname }}</span
	>
	<span class="text-label-small mt-1 text-nowrap">{{ filters.extractPseudonym(user?.userId ?? '') }}</span>
</template>

<script lang="ts" setup>
	// Packages
	import { type User as MatrixUser } from 'matrix-js-sdk';
	import { computed } from 'vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const props = defineProps({
		userId: {
			type: String,
			required: true,
		},
	});

	const { color, textColor } = useUserColor();

	const pubhubs = usePubhubsStore();

	const user = computed(getMatrixUser);
	const displayname = computed(getDisplayName);

	function getMatrixUser(): MatrixUser | undefined {
		if (pubhubs.client.getUser) {
			return pubhubs.client.getUser(props.userId) ?? undefined;
		}
		return undefined;
	}

	function getDisplayName(): string {
		if (!user.value) return '';
		return user.value.displayName as string;
	}
</script>
