<template>
	<div class="z-0 block group text-center w-24 h-24 p-2 m-2 cursor-pointer relative overflow-hidden" :title="hub ? hub.hubId : null">
		<div v-if="hub && hub.unreadMessages > 0" class="absolute top-0 right-0 group-hover:hidden">
			<Badge class="text-xxs" color="ph" v-if="hub.unreadMessages > 99">99+</Badge>
			<Badge color="ph" v-else>{{ hub.unreadMessages }}</Badge>
		</div>
		<Icon v-if="pinnable" type="plus" class="fill-green absolute right-0 top-0 hidden opacity-60 hover:opacity-100 group-hover:block" @click.prevent="pin"></Icon>
		<Icon v-if="pinned" type="remove" class="fill-red-light absolute right-0 top-0 hidden opacity-60 hover:opacity-100 group-hover:block" @click.prevent="remove"></Icon>
		<HubLogo v-if="hub" :hub-url="hub.url" :hub-id="hub.hubId" :change-to-dark="false" class="h-20 w-20 mx-auto rounded-full"></HubLogo>
		<Icon type="hub_bubble" :size="'4xl'" class="absolute top-0 left-[3px] m-auto -z-10 stroke-none opacity-0 group-hover:opacity-60" :class="{ 'opacity-100': active }"></Icon>
	</div>
</template>

<script setup lang="ts">
	import Badge from '../../../../hub-client/src/components/elements/Badge.vue';

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
