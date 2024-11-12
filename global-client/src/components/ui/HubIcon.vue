<template>
	<!-- HubLogo with unreadmessages marker -->
	<div :class="{ 'bg-white': active && !hubOrderingIsActive }" class="z-0 p-2 block group text-center w-14 h-14 cursor-pointer relative rounded-xl transition-all ease-in-out" :title="hub ? hub.hubId : null">
		<div v-if="hub && hub.unreadMessages > 0 && !hubOrderingIsActive" class="z-10 absolute -right-1 -top-1 group-hover:hidden">
			<Badge class="text-xxs" color="ph" v-if="hub.unreadMessages > 99">99+</Badge>
			<Badge color="ph" v-else>{{ hub.unreadMessages }}</Badge>
		</div>

		<Icon v-if="pinnable" type="pin" class="-rotate-45 text-ph-accent-icon-2 absolute -left-2 -top-2 hidden opacity-20 hover:opacity-100 group-hover:block" @click.prevent="pin"></Icon>
		<HubLogo v-if="hub" :hub-url="hub.url" :hub-id="hub.hubId" :change-to-dark="false" class="rounded-md"></HubLogo>
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
			default: 'xl',
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
		hubOrderingIsActive: {
			type: Boolean,
			defualt: false,
		},
	});

	const emit = defineEmits(['pin']);

	function pin() {
		emit('pin');
	}
</script>
