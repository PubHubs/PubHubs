<template>
	<div class="block group text-center mb-2 cursor-pointer relative" :title="hub ? hub.hubId : null">
		<div v-if="hub && hub.unreadMessages > 0">
			<span class="absolute flex h-3 w-3 left-8">
				<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-notification opacity-75"></span>
				<span class="absolute inline-flex rounded-full h-3 w-3 bg-notification"></span>
			</span>
		</div>
		<Icon v-if="pinnable" type="plus" class="text-green absolute right-0" @click.prevent="pin"></Icon>
		<Icon v-if="pinned" type="remove" class="text-red absolute right-0 hidden group-hover:block" @click.prevent="remove"></Icon>
		<!-- <Icon :type="type" :size="size" class="text-white mx-auto"></Icon> -->
		<HubLogo v-if="hub" :hub-url="hub.url" :hub-id="hub.hubId" :change-to-dark="false" class="h-20 w-20 mx-auto"></HubLogo>
	</div>
</template>

<script setup lang="ts">
	const props = defineProps({
		type: {
			type: String,
			default: 'circle',
		},
		size: {
			type: String,
			default: '3xl',
		},
		hub: {
			type: Object,
			default: undefined,
		},
		pinned: {
			type: Boolean,
			default: false,
		},
		pinnable: {
			type: Boolean,
			default: false,
		},
		active: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(['pin', 'remove']);

	function pin() {
		emit('pin');
	}

	function remove() {
		emit('remove');
	}
</script>
