<template>
	<div class="relative" ref="menu" v-click-outside="close" role="menubar">
		<div class="menu-icon flex cursor-pointer justify-items-stretch" @click="toggle" data-testid="actionmenu">
			<Icon class="bg-surface hover:bg-accent-primary rounded-md" type="dots-three-vertical"></Icon>
		</div>
		<div v-show="open" class="menu-menu bg-surface-elevated absolute -mt-6 ml-6 rounded-md" @click="close" :style="style">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, ref } from 'vue';

	// Components
	import Icon from '@hub-client/new-design/components/Icon.vue';

	const open = ref(false);
	const style = ref('');
	const menu = ref<HTMLElement | null>(null);

	const toggle = () => {
		open.value = !open.value;
		nextTick(() => {
			const split = Math.floor((window.innerWidth / 3) * 2);
			const menuX = menu.value?.offsetLeft;
			const buttonWidth = menu.value?.getElementsByClassName('menu-icon')[0].clientWidth;
			const menuWidth = menu.value?.getElementsByClassName('menu-menu')[0].clientWidth;
			let margin = buttonWidth;
			if (menuX! > split) {
				margin = -menuWidth!;
			}
			style.value += 'margin-left:' + margin + 'px;';
		});
	};

	const close = () => {
		open.value = false;
	};
</script>
