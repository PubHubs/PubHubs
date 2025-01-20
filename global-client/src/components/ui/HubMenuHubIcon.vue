<template>
	<!-- HubLogo with unreadmessages marker -->
	<div v-if="hub" :class="{ 'border-[3px]': active && !hubOrderingIsActive }" class="z-0 p-2 block group text-center w-14 h-14 cursor-pointer relative rounded-xl transition-all ease-in-out" :title="hub.name">
		<div v-if="hub.unreadMessages > 0 && !hubOrderingIsActive" class="z-10 absolute -right-1 -top-1 group-hover:hidden">
			<Badge class="text-xxs" color="ph" v-if="hub.unreadMessages > 99">99+</Badge>
			<Badge color="ph" v-else>{{ hub.unreadMessages }}</Badge>
		</div>

		<Icon v-if="pinnable" type="pin" class="-rotate-45 text-ph-accent-icon-2 absolute -left-2 -top-2 hidden opacity-20 hover:opacity-100 group-hover:block" @click.prevent="pin"></Icon>
		<HubIcon :hub-name="hub.name" :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" class="rounded-md"></HubIcon>
	</div>
</template>

<script setup lang="ts">
	import { Hub } from '@/store/hubs';
	import Badge from '../../../../hub-client/src/components/elements/Badge.vue';
	import HubIcon from '../../../../hub-client/src/components/shared-with-global-client/HubIcon.vue';

	type Props = {
		type?: string;
		size?: string;
		hub?: Hub;
		pinned?: boolean;
		pinnable?: boolean;
		active?: boolean;
		hubOrderingIsActive?: boolean;
	};
	const props = withDefaults(defineProps<Props>(), {
		type: 'circle',
		size: 'xl',
		hub: undefined,
		pinned: false,
		pinnable: false,
		active: false,
		hubOrderingIsActive: false,
	});

	const emit = defineEmits(['pin']);

	function pin() {
		emit('pin');
	}
</script>
