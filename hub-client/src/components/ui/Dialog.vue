/** * * Global Dialog, uses dialog.ts store. And is globally present in App.vue * */

<template>
	<div class="absolute h-screen w-screen top-0 left-0">
		<div v-if="dialog.properties.modal" class="absolute inset-0 h-screen z-10 bg-gray-middle opacity-75"></div>
		<div v-if="!dialog.properties.modalonly" class="absolute inset-0 h-screen flex z-10" @click="doAction(DialogCancel)">
			<div class="theme-light m-auto p-4 rounded-lg shadow-xl shadow-black bg-white flex flex-col justify-between gap-1" :class="width" @click.stop>
				<div>
					<Icon v-if="dialog.properties.close" type="close" size="md" class="float-right -mt-1 hover:text-red theme-light:text-gray theme-light:hover:text-red" @click="doAction(DialogCancel)"></Icon>
					<H2 v-if="dialog.properties.title !== ''" class="m-0 text-left">{{ dialog.properties.title }}</H2>
					<slot name="header"></slot>
				</div>
				<Line v-if="hasContent" class="z-0"></Line>
				<div v-if="hasContent" class="text-left overflow-y-auto py-1 h-full">
					<slot></slot>
					<div v-if="dialog.properties.content !== ''">{{ dialog.properties.content }}</div>
				</div>
				<Line class="z-0"></Line>
				<div class="flex flex-row-reverse gap-2 justify-between">
					<div v-for="(button, index) in dialog.properties.buttons" :key="index" class="">
						<Button :color="button.color" @click="doAction(button.action)" :disabled="!button.enabled">{{ $t('dialog.' + button.label) }}</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, useSlots, computed, onUnmounted } from 'vue';
	import { DialogButton, DialogButtonAction, DialogOk, DialogCancel, useDialog } from '@/store/dialog';
	const emit = defineEmits(['close']);
	const dialog = useDialog();
	const slots = useSlots();

	const hasContent = computed(() => {
		return slots['default'] || dialog.properties.content !== '';
	});

	const props = defineProps({
		title: {
			type: String,
			default: '',
		},
		width: {
			type: String,
			default: 'w-4/5 md:w-3/5 lg:w-2/5',
		},
		buttons: {
			type: Array<DialogButton>,
			default: [],
		},
	});

	onUnmounted(() => {
		dialog.hideModal();
	});

	onMounted(() => {
		if (props.title !== '') {
			dialog.properties.title = props.title;
		}
		if (props.buttons.length > 0) {
			dialog.properties.buttons = props.buttons;
		}

		dialog.showModal();
		document.addEventListener('keydown', (e) => {
			if (e.code === 'Escape') {
				doAction(DialogCancel);
			}
			if (e.code === 'Enter') {
				doAction(DialogOk);
			}
		});
	});

	function doAction(action: DialogButtonAction) {
		emit('close', action);
		dialog.hideModal();
		dialog.close(action);
	}
</script>

<style scoped>
	.adjust-left {
		transform: translateX(-2.5rem);
	}
	/* sm - width of bar = 640 - 128 =  512 */
	@media (min-width: 512px) {
		.adjust-left {
			transform: translateX(-4rem);
		}
	}
</style>
