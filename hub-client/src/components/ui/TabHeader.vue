<template>
	<div class="border-on-surface-disabled z-1 flex border-b" role="tablist" @keydown.arrow-right.prevent="focusNext" @keydown.arrow-left.prevent="focusPrev">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	function focusSibling(direction: 1 | -1) {
		const current = document.activeElement;
		if (!current) return;
		const tabs = Array.from(current.parentElement?.querySelectorAll('[role="tab"]') ?? []) as HTMLElement[];
		const index = tabs.indexOf(current as HTMLElement);
		if (index < 0) return;
		const next = tabs[(index + direction + tabs.length) % tabs.length];
		next?.focus();
		next?.click();
	}

	const focusNext = () => focusSibling(1);
	const focusPrev = () => focusSibling(-1);
</script>
