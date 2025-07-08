<template>
	<div class="relative" ref="menu" v-click-outside="close">
		<div class="menu-icon flex cursor-pointer justify-items-stretch" @click="toggle">
			<Icon class="rounded-md bg-surface p-1 hover:bg-accent-primary" type="actionmenu" size="sm"></Icon>
		</div>
		<div v-show="open" class="menu-menu absolute -mt-6 ml-6 rounded-md bg-surface" @click="close" :style="style">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { nextTick, ref } from 'vue';

	import Icon from '@/components/elements/Icon.vue';

	const open = ref(false);
	const style = ref('');
	const menu = ref<HTMLElement | null>(null);

	const toggle = () => {
		open.value = !open.value;
		nextTick(() => {
			const split = Math.floor((window.screen.width / 3) * 2);
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
