<template>
	<div
		ref="menu"
		v-click-outside="close"
		class="relative"
		role="menubar"
	>
		<div
			class="menu-icon flex cursor-pointer justify-items-stretch"
			data-testid="actionmenu"
			@click="toggle"
		>
			<Icon
				class="bg-surface hover:bg-accent-primary rounded-md"
				size="lg"
				type="dots-three-vertical"
			/>
		</div>
		<div
			v-show="open"
			class="menu-menu bg-surface absolute -mt-6 ml-6 rounded-md"
			:style="style"
			@click="close"
		>
			<slot />
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { nextTick, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const open = ref(false);
	const style = ref('');
	const menu = ref<HTMLElement | null>(null);

	const toggle = () => {
		open.value = !open.value;
		nextTick(() => {
			const split = Math.floor((window.screen.width / 3) * 2);
			const menuX = menu.value?.offsetLeft ?? 0;
			const buttonWidth = menu.value?.getElementsByClassName('menu-icon')[0]?.clientWidth ?? 0;
			const menuWidth = menu.value?.getElementsByClassName('menu-menu')[0]?.clientWidth ?? 0;
			let margin = buttonWidth;
			if (menuX > split) {
				margin = -menuWidth;
			}
			style.value += 'margin-left:' + margin + 'px;';
		});
	};

	const close = () => {
		open.value = false;
	};
</script>
