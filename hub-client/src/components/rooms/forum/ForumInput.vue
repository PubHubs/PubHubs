<template>
	<div>
		<div>
			<TextAreaWithCounter class="min-h-28 resize-none flex-col overflow-hidden md:resize-y" v-model="text" placeholder="Type your description here" :max-length="max_length">
				<template #footer-left>
					<Icon
						v-if="with_emoji"
						type="emoticon"
						:iconColor="'text-background dark:text-on-surface-variant'"
						size="base"
						@click.stop="showEmojiPicker = !showEmojiPicker"
						:asButton="true"
						class="bg-accent-secondary rounded-full"
					/>
					<PluginIcon v-if="with_file" type="upload" @click="clickedAttachment" :asButton="true" class="pr-2" />
					<LocalMessageImage v-if="image" :event="image" @remove="image = null" />
					<LocalMessageFile v-if="file" :event="file" @remove="file = null" />
				</template>
				<template #footer-right-r>
					<div v-if="with_send" class="overflow-hidden rounded-full">
						<Button
							class="bg-hub-background-4 flex aspect-square h-7 w-7 items-center justify-center !rounded-full !p-0"
							:class="!isFormValid && 'opacity-50 hover:cursor-default'"
							:disabled="!isFormValid"
							@click="emit('submit', { text: text, image: image, file: file })"
						>
							<Icon type="send" size="sm" class="text-hub-text-variant shrink-0" />
						</Button>
					</div>
				</template>
			</TextAreaWithCounter>
		</div>

		<FileUploadDialog
			:file="fileInfo"
			:blobURL="uri"
			v-if="showFileUploadDialog && with_file"
			@submit="onFileUpload"
			@close="
				showFileUploadDialog = false;
				fileUploading = false;
			"
		>
		</FileUploadDialog>
		<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" ref="elFileInput" @change="uploadFile($event)" @cancel="fileUploading = false" hidden />

		<div v-if="with_emoji" class="relative">
			<div v-if="showEmojiPicker" class="xs:right-4 absolute right-0 bottom-2 z-20 md:right-32">
				<EmojiPicker @emojiSelected="text += $event" @close="showEmojiPicker = false" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
	import Button from '@/components/elements/Button.vue';
	import Icon from '@/components/elements/Icon.vue';
	import EmojiPicker from '@/components/ui/EmojiPicker.vue';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { TFileMessageEventContent, TImageMessageEventContent, TMessageEvent, TMessageEventContent } from '@/model/events/TMessageEvent';
	import { TLocalAttachmentMessageEventContent } from '@/plugins/PluginRoomTypeForum/TLocalEventContent';
	import PluginIcon from '@/plugins/PluginRoomTypeForum/components/elements/Icon.vue';
	import TextAreaWithCounter from '@/plugins/PluginRoomTypeForum/components/forms/TextAreaWithCounter.vue';
	import FileUploadDialog from '@/plugins/PluginRoomTypeForum/components/ui/FileUploadDialog.vue';
	import LocalMessageFile from '@/plugins/PluginRoomTypeForum/components/ui/LocalMessageFile.vue';
	import LocalMessageImage from '@/plugins/PluginRoomTypeForum/components/ui/LocalMessageImage.vue';
	import { MsgType } from 'matrix-js-sdk';
	import { computed, ref, watch } from 'vue';

	const { allTypes, getTypesAsString } = useMatrixFiles();

	type Props = {
		with_emoji?: boolean;
		with_file?: boolean;
		with_send?: boolean;
		min_length?: number;
		max_length?: number;
		default_input?: string;
		default_file?: TMessageEvent<TMessageEventContent>;
		default_image?: TMessageEvent<TMessageEventContent>;
	};

	const props = withDefaults(defineProps<Props>(), {
		with_emoji: true,
		with_file: true,
		with_send: true,
		min_length: 0,
		max_length: Number.MAX_VALUE,
	});

	const emit = defineEmits(['submit', 'change:text', 'change:image', 'change:file']);

	const text = ref<string>(props.default_input ?? '');
	const file = ref<TLocalAttachmentMessageEventContent | TFileMessageEventContent | null>((props.default_file?.content as TFileMessageEventContent) ?? null);
	const image = ref<TLocalAttachmentMessageEventContent | TImageMessageEventContent | null>((props.default_image?.content as TImageMessageEventContent) ?? null);

	const showEmojiPicker = ref<boolean>(false);
	const showFileUploadDialog = ref<boolean>(false);
	const fileUploading = ref<boolean>(false); // to hide other dialogs while in the file upload process
	const fileInfo = ref<File>();
	const uri = ref<string>('');
	const elFileInput = ref<HTMLInputElement | null>(null);

	watch(text, (newText) => {
		emit('change:text', newText);
	});

	watch(image, (newImage) => {
		emit('change:image', newImage);
	});

	watch(file, (newFile) => {
		emit('change:file', newFile);
	});

	const isFormValid = computed(() => {
		const len = text.value.trim().length;
		return len >= props.min_length && len <= props.max_length;
	});

	function onFileUpload(event: TLocalAttachmentMessageEventContent) {
		if (event.msgtype == MsgType.Image) {
			image.value = event;
		} else {
			file.value = event;
		}
	}

	function clickedAttachment() {
		fileUploading.value = true;
		elFileInput.value?.click();
	}

	function uploadFile(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files && target.files[0];
		if (file) {
			// Once the file has been selected from the filesystem.
			// Set props to be passed to the component.
			fileInfo.value = file;
			uri.value = URL.createObjectURL(file);
			// display the component.
			showFileUploadDialog.value = true;
			// Inspiration from  https://dev.to/schirrel/vue-and-input-file-clear-file-or-select-same-file-24do
			const inputElement = elFileInput.value;
			if (inputElement) inputElement.value = '';
		}
	}
</script>
