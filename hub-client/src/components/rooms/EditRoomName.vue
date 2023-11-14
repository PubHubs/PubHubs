<template>
	<Dialog :title="$t('admin.edit_name')" :buttons="buttonsSubmitCancel" width="w-3/6" @close="close($event)">
		<TextInput v-model="newName" class="w-full"></TextInput>
	</Dialog>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { buttonsSubmitCancel, DialogButtonAction, useDialog } from '@/store/dialog';

	const props = defineProps({
		room: {
			type: Object,
			required: true,
		},
	});

	const newName = ref(props.room.name);

	const emit = defineEmits(['close']);

	async function close(returnValue: DialogButtonAction) {
		if (returnValue == 1) {
			const pubhubs = usePubHubs();
			try {
				await pubhubs.renameRoom(props.room.room_id, newName.value);
			} catch (error) {
				emit('close');
				const dialog = useDialog();
				await dialog.confirm('ERROR', error);
			}
		}
		emit('close');
	}
</script>
