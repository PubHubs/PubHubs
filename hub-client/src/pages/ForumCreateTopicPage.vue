<template>
	<HeaderFooter>
		<div class="mx-auto w-full md:w-2/3">
			<div>
				<TextArea
					v-model="title"
					placeholder="Type your title here"
					:help="'Be specific and imagine you\'re asking a question to another person Minimum ' + TITLE_MIN_LENGTH + ' characters'"
					:validation="{ maxLength: TITLE_MAX_LENGTH }"
					>Title</TextArea
				>
			</div>

			<div class="p-5">
				<LabelWithDescription class="pb-2">
					Description
					<template #description>
						<p>Introduce the problem and expand on what you put in the title</p>
						<p>Minimum {{ DESCRIPTION_MIN_LENGTH }} characters</p>
					</template>
				</LabelWithDescription>
				<ForumInput :with_send="false" :max_length="DESCRIPTION_MAX_LENGTH" @change:text="description = $event" @change:image="imageEvent = $event" @change:file="fileEvent = $event" />
			</div>

			<div class="flex justify-between p-5 pt-0">
				<Button color="red" @click="cancelPost"> Cancel </Button>
				<Button @click="submitPost" :disabled="!isFormValid"> Submit </Button>
			</div>
			<InlineSpinner v-if="isSubmitting"></InlineSpinner>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { TimelineWindow } from 'matrix-js-sdk';
	import { computed, ref } from 'vue';
	import { useRouter } from 'vue-router';

	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	import { TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

	import { DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH, TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from '@hub-client/services/forum/properties';

	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

	import Button from '@hub-client/new-design/components/Button.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';

	const router = useRouter();
	const title = ref<string>('');
	const description = ref<string>('');
	const fileEvent = ref<TLocalAttachmentMessageEventContent | null>(null);
	const imageEvent = ref<TLocalAttachmentMessageEventContent | null>(null);

	const forumStore = useForumStore();
	const timelineStore = useTimelineStore();

	const isSubmitting = ref(false);
	const isFormValid = computed(() => title.value.trim().length >= TITLE_MIN_LENGTH && description.value.trim().length >= DESCRIPTION_MIN_LENGTH);

	const cancelPost = () => {
		console.log('Topic creation cancelled');
		router.back();
	};

	const submitPost = async () => {
		try {
			isSubmitting.value = true;
			const topic = await forumStore.sendTopic(title.value, description.value, false);
			if (!topic) {
				logger.error(SMI.STORE, 'Failed to create topic');
				return;
			}

			if (fileEvent.value) {
				await forumStore.sendAttachment(fileEvent.value, topic.event_id);
			}
			if (imageEvent.value) {
				await forumStore.sendAttachment(imageEvent.value, topic.event_id);
			}
			await forumStore.fetchTopics(timelineStore.tw as TimelineWindow);
			await router.push(`/topic/${topic!.event_id}`);
		} catch (error) {
			logger.trace(SMI.STORE, 'error in submiting forum post', { error });
		} finally {
			isSubmitting.value = false;
		}
	};
</script>
