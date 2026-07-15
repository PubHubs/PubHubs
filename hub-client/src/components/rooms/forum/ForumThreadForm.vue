<template>
	<div
		ref="elForm"
		class="bg-surface-base rounded-base"
		:class="isMobile ? 'p-200' : 'p-300'"
	>
		<ValidatedForm @validated="(v: boolean) => (formValid = v)">
			<TextField
				v-model="title"
				:placeholder="$t('message.forum.title')"
				:help="$t('message.forum.help_title')"
				:validation="{ required: true, minLength: 4, maxLength: 80 }"
				>{{ $t('message.forum.title') }}</TextField
			>
			<TextArea
				v-model="description"
				auto-grow
				:rows="5"
				:placeholder="$t('message.forum.description')"
				:help="$t('message.forum.help_description')"
				:validation="{ required: true, minLength: 15 }"
				>{{ $t('message.forum.description') }}</TextArea
			>
		</ValidatedForm>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';

	import { createLogger } from '@hub-client/logic/logging/Logger';

	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';

	const props = defineProps<{
		id: string;
		// When given, the form edits this forum topic instead of creating a new one.
		event?: TMessageEvent;
	}>();

	const logger = createLogger('ForumThreadForm');
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const elForm = ref<HTMLElement | null>(null);
	const title = ref<string>(props.event?.content?.body ?? '');
	const description = ref<string>(
		(props.event?.content?.ph_topic_body as string | undefined) ?? (props.event?.content?.description as string | undefined) ?? '',
	);
	const formValid = ref(false);

	onMounted(() => {
		elForm.value?.querySelector('input')?.focus();
	});

	const submitPost = async () => {
		try {
			const pubhubs = usePubhubsStore();
			if (props.event) {
				await pubhubs.editForumThread(props.id, props.event, title.value, description.value);
			} else {
				await pubhubs.addForumThread(props.id, title.value, description.value);
			}
		} catch (error) {
			logger.error('error in submiting forum post', { error });
		}
	};

	defineExpose({ submitPost, formValid });
</script>
