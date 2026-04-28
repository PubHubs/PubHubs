<template>
	<div class="bg-surface-low my-400 p-200">
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

			<ButtonGroup class="mt-200">
				<Button
					variant="error"
					@click.stop.prevent="router.back()"
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
	import { useRouter } from 'vue-router';

	import { createLogger } from '@hub-client/logic/logging/Logger';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	defineProps({
		id: {
			type: String,
			required: true,
		},
	});

	const emit = defineEmits(['close']);

	const logger = createLogger('ForumCreateTopicPage');

	const router = useRouter();
	const title = ref<string>('');
	const description = ref<string>('');

	const submitPost = async () => {
		try {
			const rooms = useRooms();
			const pubhubs = usePubhubsStore();
			await pubhubs.addForumThread(rooms.currentRoomId, title.value, description.value);
		} catch (error) {
			logger.error('error in submiting forum post', { error });
		} finally {
			emit('close');
		}
	};
</script>
