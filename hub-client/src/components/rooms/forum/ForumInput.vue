<template>
	<div>
		<div>
			<ValidatedForm
				v-slot="{ isValidated }"
				class="rounded-xl border p-200"
			>
				<TextArea
					v-model="text"
					placeholder="Type your description here"
					:validation="{ required: true, maxLength: maxLength }"
					>Your Reply</TextArea
				>

				<div class="flex items-center justify-between gap-2">
					<div>
						<LocalMessageImage
							v-if="image"
							:event="image"
							@remove="image = null"
						/>
						<LocalMessageFile
							v-if="file"
							:event="file"
							@remove="file = null"
						/>
					</div>
					<div class="flex items-center gap-2">
						<Button
							icon="smiley"
							variant="tertiary"
							@click.stop="showEmojiPicker = !showEmojiPicker"
						></Button>
						<Button
							icon="upload-simple"
							variant="tertiary"
							@click="clickedAttachment"
						></Button>
						<Button
							icon="paper-plane-right"
							:disabled="!isValidated"
							title="submit"
							@click="emit('submit', { text: text, image: image, file: file })"
						></Button>
					</div>
				</div>
			</ValidatedForm>
		</div>

		<FileUploadDialog
			v-if="showFileUploadDialog && withFile"
			:file="fileInfo"
			:blob-u-r-l="uri"
			@submit="onFileUpload"
			@close="
				showFileUploadDialog = false;
				fileUploading = false;
			"
		>
		</FileUploadDialog>
		<input
			ref="elFileInput"
			type="file"
			:accept="getTypesAsString(allTypes)"
			class="attach-file"
			hidden
			@change="uploadFile($event)"
			@cancel="fileUploading = false"
		/>

		<div
			v-if="withEmoji"
			class="relative"
		>
			<div
				v-if="showEmojiPicker"
				class="xs:right-4 absolute right-0 bottom-2 z-20 md:right-32"
			>
				<EmojiPicker
					@emoji-selected="text += $event"
					@close="showEmojiPicker = false"
				/>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
	import { MsgType } from 'matrix-js-sdk';
	import { ref, watch } from 'vue';

	import FileUploadDialog from '@hub-client/components/rooms/forum/FileUploadDialog.vue';
	import LocalMessageFile from '@hub-client/components/rooms/forum/LocalMessageFile.vue';
	import LocalMessageImage from '@hub-client/components/rooms/forum/LocalMessageImage.vue';
	import EmojiPicker from '@hub-client/components/ui/EmojiPicker.vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import {
		type TFileMessageEventContent,
		type TImageMessageEventContent,
		type TMessageEvent,
		type TMessageEventContent,
	} from '@hub-client/models/events/TMessageEvent';
	import { type TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

	import Button from '@hub-client/new-design/components/Button.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	const props = withDefaults(defineProps<Props>(), {
		withEmoji: true,
		withFile: true,
		withSend: true,
		minLength: 0,
		maxLength: Number.MAX_VALUE,
	});

	const emit = defineEmits(['submit', 'change:text', 'change:image', 'change:file']);

	const { allTypes, getTypesAsString } = useMatrixFiles();

	type Props = {
		withEmoji?: boolean;

		withFile?: boolean;

		withSend?: boolean;

		minLength?: number;

		maxLength?: number;
		// eslint-disable-next-line -- temp code
		defaultInput?: string;
		// eslint-disable-next-line -- temp code
		defaultFile?: TMessageEvent<TMessageEventContent>;
		// eslint-disable-next-line -- temp code
		defaultImage?: TMessageEvent<TMessageEventContent>;
	};

	const text = ref<string>(props.defaultInput ?? '');
	const file = ref<TLocalAttachmentMessageEventContent | TFileMessageEventContent | null>((props.defaultFile?.content as TFileMessageEventContent) ?? null);
	const image = ref<TLocalAttachmentMessageEventContent | TImageMessageEventContent | null>(
		(props.defaultImage?.content as TImageMessageEventContent) ?? null,
	);

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

	// const isFormValid = computed(() => {
	// 	const len = text.value.trim().length;
	// 	return len >= props.minLength && len <= props.maxLength;
	// });

	function onFileUpload(event: TLocalAttachmentMessageEventContent) {
		if (event.msgtype === MsgType.Image) {
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
