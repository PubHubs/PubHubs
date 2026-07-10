<template>
	<div class="bg-surface-base my-400">
		<ValidatedForm
			v-slot="{ isValidated }"
			class="p-200"
		>
			<TextField
				v-model="title"
				:placeholder="$t('message.forum.title')"
				:help="$t('message.forum.help_title')"
				:validation="{ required: true, minLength: 15, maxLength: 80 }"
				>{{ $t('message.forum.title') }}</TextField
			>
			<TextArea
				v-model="description"
				:placeholder="$t('message.forum.description')"
				:help="$t('message.forum.help_description')"
				:validation="{ required: true, minLength: 15 }"
				>{{ $t('message.forum.description') }}</TextArea
			>

			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="emit('close')"
					>{{ $t('dialog.cancel') }}</Button
				>
				<Button
					type="submit"
					:disabled="!isValidated"
					@click.stop.prevent="submitPost()"
					>{{ $t('forms.submit') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';

	import { createLogger } from '@hub-client/logic/logging/Logger';

	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const props = defineProps<{
		id: string;
		event?: TMessageEvent;
	}>();

	const emit = defineEmits(['close']);

	const logger = createLogger('ForumThreadForm');

	const title = ref<string>(props.event?.content?.body ?? '');
	const description = ref<string>(
		(props.event?.content?.ph_topic_body as string | undefined) ?? (props.event?.content?.description as string | undefined) ?? '',
	);

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
		} finally {
			emit('close');
		}
	};
</script>
