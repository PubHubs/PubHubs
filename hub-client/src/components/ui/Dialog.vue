/** * * Global Dialog, uses dialog.ts store. And is globally present in App.vue * */

<template>
	<div class="absolute h-screen w-screen top-0 left-0">
		<div v-if="dialog.properties.modal" class="absolute inset-0 h-screen z-0 bg-gray-middle opacity-75"></div>
		<div v-if="!dialog.properties.modalonly" class="absolute inset-0 h-screen flex z-10" @click="doAction(DialogFalse)">
			<div class="theme-light m-auto p-4 rounded-lg shadow-xl shadow-black bg-white" :class="centerClass" @click.stop>
				<div>
					<Icon v-if="dialog.properties.close" type="close" size="md" class="float-right -mt-1 hover:text-red theme-light:text-gray theme-light:hover:text-red" @click="doAction(DialogFalse)"></Icon>
					<H2 v-if="dialog.properties.title !== ''" class="m-0 text-left">{{ dialog.properties.title }}</H2>
					<slot name="header"></slot>
				</div>
				<Line v-if="hasContent" class="mt-2 mb-2 z-0"></Line>
				<div v-if="hasContent" class="text-left min-h-96 overflow-auto py-1">
					<slot></slot>
					<div v-if="dialog.properties.content !== ''">{{ dialog.properties.content }}</div>
				</div>
				<Line class="mt-2 mb-3 z-0"></Line>
				<div class="flex flex-row-reverse">
					<div v-for="(button, index) in dialog.properties.buttons" :key="index" class="ml-2">
						<Button :color="button.color" @click="doAction(button.action)">{{ $t('dialog.' + button.label) }}</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, useSlots, computed } from 'vue';
	import { DialogButton, DialogButtonAction, DialogTrue, DialogFalse, useDialog } from '@/store/dialog';
	const emit = defineEmits(['close']);
	const dialog = useDialog();
	const slots = useSlots();

	const hasContent = computed(() => {
		return slots['default'] || dialog.properties.content !== '';
	});

	const centerClass = computed(() => {
		let c = props.width;
		if (window.self !== window.top) {
			c += ' adjust-left';
		}
		return c;
	});

	const props = defineProps({
		title: {
			type: String,
			default: '',
		},
		width: {
			type: String,
			default: 'w-2/3',
		},
		buttons: {
			type: Array<DialogButton>,
			default: [],
		},
	});

	onMounted(() => {
		if (props.title !== '') {
			dialog.properties.title = props.title;
		}
		if (props.buttons.length > 0) {
			dialog.properties.buttons = props.buttons;
		}

		document.addEventListener('keydown', (e) => {
			if (e.code == 'Escape') {
				doAction(DialogFalse);
			}
			if (e.code == 'Enter') {
				doAction(DialogTrue);
			}
		});
	});

	function doAction(action: DialogButtonAction) {
		emit('close', action);
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
