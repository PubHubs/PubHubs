<template>
	<HeaderFooter
		bg-bar-low="bg-background"
		bg-bar-medium="bg-surface-low"
	>
		<template #header>
			<div class="text-on-surface-dim hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ $t('message.forum.add_new_thread') }}</span>
				<hr class="bg-on-surface-dim h-025 grow" />
			</div>
			<div class="flex h-full items-center">
				<div class="flex w-fit items-center gap-3">
					<Icon
						type="caret-left"
						data-testid="back"
						class="cursor-pointer"
						@click.stop="router.back()"
					/>
					<H3 class="font-headings text-on-surface font-semibold">{{ title }}</H3>
				</div>
			</div>
		</template>

		<ValidatedForm
			v-slot="{ isValidated }"
			:disabled="isSubmitting"
			class="w-min-4000 w-max-7000 w-2/3 p-200"
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
		<InlineSpinner v-if="isSubmitting"></InlineSpinner>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRouter } from 'vue-router';

	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

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

	const logger = createLogger('ForumCreateTopicPage');

	const router = useRouter();
	const title = ref<string>('');
	const description = ref<string>('');

	const isSubmitting = ref(false);

	const submitPost = async () => {
		try {
			isSubmitting.value = true;
			const rooms = useRooms();
			const pubhubs = usePubhubsStore();
			await pubhubs.addForumThread(rooms.currentRoomId, title.value, description.value);
			await router.push({ name: 'room', params: { id: rooms.currentRoomId } });
		} catch (error) {
			logger.error('error in submiting forum post', { error });
		} finally {
			isSubmitting.value = false;
		}
	};
</script>
