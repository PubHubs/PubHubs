<template>
	<span class="truncate" :title="displayname" :class="`${textColor(color(user?.userId))}`">{{ displayname }}</span>
	<span class="mt-1 text-nowrap ~text-label-small-min/label-small-max">{{ filters.extractPseudonym(user?.userId) }}</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import filters from '@/logic/core/filters';
	import { useUserColor } from '@/logic/composables/useUserColor';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { User as MatrixUser } from 'matrix-js-sdk';

	const { color, textColor } = useUserColor();

	const pubhubs = usePubHubs();

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
