<template>
	<Dialog :title="$t('admin.ask_disclosure_title')" :width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'" @close="close($event)">
		<ValidatedForm @submit.prevent class="flex flex-col p-200" :class="isMobile ? 'w-full' : 'w-[450px]'" v-slot="{ isValidated }">
			<DropDown v-model="form.user" :transformer="transformUser" :options="userOptions" :filtered="true" :validation="{ required: true }">{{ $t('admin.ask_disclosure_user_title') }}</DropDown>
			<DropDown v-model="form.attributes" :transformer="transformYiviAttribute" :options="yiviAttributes" :multiple="true" :filtered="true" :validation="{ required: true }">{{ $t('admin.secured_yivi_attributes') }}</DropDown>
			<DropDown v-model="form.where_room" :transformer="transformRoom" :options="roomOptions" :filtered="true" :validation="{ required: true }">{{ $t('rooms.room') }}</DropDown>

			<TextArea placeholder="Add a message to your disclosure request" :validation="{ required: true, maxLength: 100 }" v-model="form.message" @keydown.esc.stop>{{ $t('admin.ask_disclosure_message_title') }}</TextArea>

			<ButtonGroup>
				<Button variant="error" @click.stop.prevent="close()">{{ t('dialog.cancel') }}</Button>
				<Button type="submit" :disabled="!isValidated" @click.stop.prevent="onSubmit()">{{ t('dialog.submit') }}</Button>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { AskDisclosure, AskDisclosureMessage } from '@hub-client/models/components/signedMessages';
	import { TUserAccount } from '@hub-client/models/users/TUser';
	import { Attribute } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { TPublicRoom } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import DropDown from '@hub-client/new-design/components/forms/DropDown.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';
	import { transformBack, transformRoom, transformUser, transformYiviAttribute, useDropDownData } from '@hub-client/new-design/composables/DropDownData.composable';

	// const yiviStore = useYivi();
	const pubhubsStore = usePubhubsStore();
	const dropDownData = useDropDownData();

	const { t } = useI18n();
	const emit = defineEmits(['close']);
	const roomOptions = ref<TPublicRoom[]>([]);
	const userOptions = ref<TUserAccount[]>([]);
	const yiviAttributes = dropDownData.yiviAttributes();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const props = defineProps<{
		user: TUserAccount;
	}>();

	const defaultPrivateRoom = { room_id: '', name: t('admin.private_room') };

	const form = ref<AskDisclosure>({
		user: { name: '' },
		message: '',
		attributes: [yiviAttributes[0]], // e-mail
		where_room: defaultPrivateRoom,
	});

	onBeforeMount(async () => {
		roomOptions.value = await dropDownData.publicRoomList();
		roomOptions.value = [defaultPrivateRoom, ...roomOptions.value];
		userOptions.value = await dropDownData.userList();

		form.value.user = {
			name: props.user.name,
			displayname: props.user.displayname,
		} as TUserAccount;
	});

	async function close() {
		emit('close');
	}

	async function onSubmit() {
		let roomId = form.value.where_room.room_id;
		if (!roomId || form.value.where_room.name === t('admin.private_room')) {
			const privateRoom = await pubhubsStore.createPrivateRoomWith([form.value.user.name]);
			roomId = privateRoom!.room_id;
		}
		const result: AskDisclosureMessage = {
			userId: form.value.user?.name,
			replyToRoomId: roomId,
			message: form.value.message,
			attributes: form.value.attributes.map((item: Attribute) => item.attribute),
		};
		// Message is duplicated in body and in 'result' object.
		await pubhubsStore.addAskDisclosureMessage(roomId, result.message, result);
		close();
	}
</script>
