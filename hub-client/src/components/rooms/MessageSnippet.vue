<template>
	<div class="bg-gray-light dark:bg-gray-darker flex items-center rounded-md">
		<p v-if="showInReplyTo" class="ml-1 mr-1 shrink-0">{{ $t('message.in_reply_to') }}</p>
		<H3 class="mr-2 ml-2 my-0 shrink-0" :class="textColor(userColor)">
			<UserDisplayName :user="event.sender"></UserDisplayName>
		</H3>
		<p class="mr-2 truncate">{{ text }}</p>
	</div>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/composables/useUserColor';
	import { computed } from 'vue';

	const { color, textColor } = useUserColor();

	type Props = {
		event: Record<string, any>;
		showInReplyTo?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		showInReplyTo: false,
	});

	const userColor = computed(() => color(props.event.sender) || 0);
	const text = computed(() => {
		return props.event.content?.body as string;
	});
</script>
