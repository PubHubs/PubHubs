<template>
	<div class="relative" aria-label="Menu">
		<svg width="30" height="30" viewBox="0 0 24 24" class="cursor-pointer">
			<circle cx="6" cy="12" r="2" fill="currentColor" />
			<circle cx="12" cy="12" r="2" fill="currentColor" />
			<circle cx="18" cy="12" r="2" fill="currentColor" />
		</svg>
		<div v-if="showMenu" class="absolute top-0 right-0 z-50 w-36" data-test="menu">
			<div class="m-2 mt-8 overflow-hidden rounded-md border-2">
				<div class="bg-background hover:bg-on-surface-dim active:bg-on-surface-dim cursor-pointer px-4 py-2" @click="handleAction('report')" data-test="report">Report</div>
				<div v-if="showClose" class="bg-background hover:bg-on-surface-dim active:bg-on-surface-dim cursor-pointer px-4 py-2" @click="handleAction('close')" data-test="close">Close</div>
				<div v-if="showOpen" class="bg-background hover:bg-on-surface-dim active:bg-on-surface-dim cursor-pointer px-4 py-2" @click="handleAction('open')" data-test="open">Open</div>
				<div v-if="showDelete" class="bg-background hover:bg-on-surface-dim active:bg-on-surface-dim cursor-pointer px-4 py-2" @click="handleAction('delete')" data-test="delete">Delete</div>
				<div v-if="showEdit" class="bg-background hover:bg-on-surface-dim active:bg-on-surface-dim cursor-pointer px-4 py-2" @click="handleAction('edit')" data-test="edit">Edit</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	const emit = defineEmits(['report', 'delete', 'close', 'edit', 'open']);

	const props = defineProps({
		showClose: {
			type: Boolean,
			default: false,
		},
		showOpen: {
			type: Boolean,
			default: false,
		},
		// This was decided to be a prop to allow the parent to control the menu
		// as usually we would want to have multiple dots menu and only 1 open at a time
		showMenu: {
			type: Boolean,
			default: false,
		},
		showDelete: {
			type: Boolean,
			default: false,
		},
		showEdit: {
			type: Boolean,
			default: false,
		},
	});

	const handleAction = (action: 'report' | 'delete' | 'close' | 'edit' | 'open') => {
		emit(action);
		if (action === 'report') {
			alert(action);
		}
	};
</script>
