<template>
	<Teleport to="body">
		<Dialog
			v-if="open"
			:title="$t(event ? 'message.forum.edit_thread' : 'message.forum.add_new_thread')"
			:buttons="dialogButtons"
			:width="isMobile ? 'w-4/5' : 'w-2/5'"
			@close="handleClose"
		>
			<ForumThreadForm
				:id="id"
				ref="threadForm"
				:event="event"
			/>
		</Dialog>
	</Teleport>
</template>

<script setup lang="ts">
	import { computed, ref, unref } from 'vue';

	import ForumThreadForm from '@hub-client/components/rooms/forum/ForumThreadForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	import { DialogButton, DialogCancel, DialogSubmit } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';

	defineProps<{
		id: string;
		open: boolean;
		// When given, the dialog edits this forum topic instead of creating a new one.
		event?: TMessageEvent;
	}>();

	const emit = defineEmits<{
		(e: 'update:open', value: boolean): void;
	}>();

	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const threadForm = ref<InstanceType<typeof ForumThreadForm>>();

	const dialogButtons = computed(() => {
		const valid = unref(threadForm.value?.formValid) ?? false;
		const submitBtn = new DialogButton('submit', 'primary', DialogSubmit);
		submitBtn.enabled = valid;
		const cancelBtn = new DialogButton('cancel', 'secondary', DialogCancel);
		return [submitBtn, cancelBtn];
	});

	const handleClose = (action?: number) => {
		if (action === DialogSubmit) {
			threadForm.value?.submitPost();
		}
		emit('update:open', false);
	};
</script>
