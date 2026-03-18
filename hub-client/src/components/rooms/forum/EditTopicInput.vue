<template>
	<TextArea v-if="!reply" v-model="title" :validation="{ required: true, minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH }">Title</TextArea>
	<ForumInput
		:min_length="Math.max(REPLY_MIN_LENGTH, TITLE_MIN_LENGTH)"
		:max_length="REPLY_MAX_LENGTH"
		:default_input="topic.body"
		:default_image="topic.image"
		:default_file="topic.file"
		@change:text="body = $event"
		@change:image="handleImageChange"
		@change:file="handleFileChange"
		@submit="editTopic"
	/>
	<InlineSpinner v-if="isSubmitting"></InlineSpinner>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	import ForumInput from '@hub-client/components/rooms/forum/ForumInput.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	import { TFileMessageEventContent, TImageMessageEventContent, TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';
	import { TThread } from '@hub-client/models/events/forum/TThread';
	import Room from '@hub-client/models/rooms/Room';

	import { createDummyEvent, createDummyFile, createDummyImage } from '@hub-client/services/forum/forumHelpers';
	import { REPLY_MAX_LENGTH, REPLY_MIN_LENGTH, TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from '@hub-client/services/forum/properties';

	import { useForumStore } from '@hub-client/stores/forum/forumStore';

	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';

	type Props = {
		topic: TThread;
		reply: boolean;
		mainTopic: TThread;
		room: Room;
	};

	const props = withDefaults(defineProps<Props>(), {
		reply: false,
	});

	const emit = defineEmits(['submit']);

	const forumStore = useForumStore();

	let title = ref<string>(props.topic.title);
	let body = ref<string>(props.topic.body);
	let image = ref<TLocalAttachmentMessageEventContent | null>(null);
	let file = ref<TLocalAttachmentMessageEventContent | null>(null);
	const imageChanged = ref(false);
	const fileChanged = ref(false);
	const isSubmitting = ref(false);

	const handleImageChange = (newImage: TLocalAttachmentMessageEventContent | null) => {
		image.value = newImage;
		imageChanged.value = true;
	};

	const handleFileChange = (newFile: TLocalAttachmentMessageEventContent | null) => {
		file.value = newFile;
		fileChanged.value = true;
	};

	const editTopic = async () => {
		isSubmitting.value = true;

		if (!props.reply) {
			await forumStore.sendTopic(title.value, body.value, false, props.topic.eventId, props.topic.title, props.topic.body);
		} else {
			await forumStore.sendReply(props.mainTopic.eventId, body.value, props.topic.eventId, props.topic.body);
		}

		// wrap local image/file into dummy TMessageEvent<…>
		let dummyImage: TMessageEvent<TImageMessageEventContent> | undefined = undefined;
		let dummyFile: TMessageEvent<TFileMessageEventContent> | undefined = undefined;
		if (fileChanged.value) {
			if (file.value) {
				const oldFileEvent = props.topic.file?.event_id ? props.topic.file : undefined;
				const fileResult = await forumStore.sendAttachment(file.value, props.topic.eventId, oldFileEvent);
				dummyFile = createDummyFile(fileResult.id, fileResult.url, file.value);
			} else {
				props.room.deleteMessage(props.topic.file!); // Deleting does not work.
				dummyFile = undefined;
			}
		}

		if (imageChanged.value) {
			if (image.value) {
				const oldImageEvent = props.topic.image?.event_id ? props.topic.image : undefined;
				const imageResult = await forumStore.sendAttachment(image.value, props.topic.eventId, oldImageEvent);
				dummyImage = createDummyImage(imageResult.id, imageResult.url, image.value);
			} else {
				props.room.deleteMessage(props.topic.image!); // Deleting does not work.
				dummyImage = undefined;
			}
		}

		const newDummyEvent = createDummyEvent(true, props.topic.eventId, body.value, title.value, undefined, dummyImage, dummyFile);

		if (imageChanged.value && !image.value) {
			newDummyEvent.image = undefined;
		}
		if (fileChanged.value && !file.value) {
			newDummyEvent.file = undefined;
		}

		if (!props.reply) {
			forumStore.addEditedEventToTopicList(newDummyEvent);
		} else {
			forumStore.addEditedEventToTopicList(newDummyEvent, props.topic.eventId);
		}
		isSubmitting.value = false;
		emit('submit');
	};
</script>
