<template>
	<div v-if="url" class="mt-2 rounded-md bg-hub-background-3 p-2 flex">
		<Icon type="paperclip" class="mr-2"></Icon>
		<a class="text-blue" target="_blank" :href="url">{{ message.filename }}</a>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { TFileMessageEventContent } from '@/model/events/TMessageEvent';

	defineProps<{ message: TFileMessageEventContent }>();
</script>
