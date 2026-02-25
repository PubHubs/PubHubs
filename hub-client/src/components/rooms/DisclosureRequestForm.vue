<template>
	<Dialog :title="$t('admin.ask_disclosure_title')" :width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'" @close="close($event)">
		<ValidatedForm @submit.prevent class="flex flex-col p-200" :class="isMobile ? 'w-full' : 'w-[450px]'" v-slot="{ isValidated }">
			<DropDown v-model="ask.user" :options="userOptions" :filtered="true" :validation="{ required: true }">{{ $t('admin.ask_disclosure_user_title') }}</DropDown>
			<DropDown v-model="ask.attributes" :options="yiviAttributes" :multiple="true" :validation="{ required: true }">{{ $t('admin.secured_yivi_attributes') }}</DropDown>
			<DropDown v-model="ask.where_room" :options="roomOptions" :filtered="true" :validation="{ required: true }">{{ $t('rooms.room') }}</DropDown>

			<TextArea placeholder="Add a message to your disclosure request" :validation="{ required: true, maxLength: 100 }" v-model="ask.message" @keydown.esc.stop>{{ $t('admin.ask_disclosure_message_title') }}</TextArea>

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
	import { FieldOptions } from '@hub-client/models/validation/TFormOption';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { User, useUser } from '@hub-client/stores/user';
	import { useYivi } from '@hub-client/stores/yivi';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import DropDown from '@hub-client/new-design/components/forms/DropDown.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';
	import { transformBack, transformUser, useDropDownData } from '@hub-client/new-design/composables/DropDownData.composable';

	const yiviStore = useYivi();
	const pubhubsStore = usePubhubsStore();

	const { t } = useI18n();
	const emit = defineEmits(['close']);
	const selectUser = ref<boolean>(false);
	const roomOptions = ref<FieldOptions>([]);
	const userOptions = ref<FieldOptions>([]);
	const yiviAttributes = yiviStore.getAttributes(t).map((item) => item.label);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const props = defineProps<{
		user: TUserAccount;
	}>();

	const defaultPrivateRoom = { value: '', label: t('admin.private_room') };

	const ask = ref<AskDisclosure>({
		user: { userId: '' },
		message: '',
		attributes: [t('attribute.pbdf.sidn-pbdf.email.email')],
		where_room: t('admin.private_room'),
	});

	onBeforeMount(async () => {
		const dropDownData = useDropDownData();
		roomOptions.value = await dropDownData.publicRoomList();
		roomOptions.value = [defaultPrivateRoom, ...roomOptions.value];
		userOptions.value = await dropDownData.userList();

		ask.value.user = {
			userId: props.user.name,
			displayName: props.user.displayname,
		};
	});

	async function close() {
		emit('close');
	}

	async function onSubmit() {
		let roomId = ask.value.where_room;
		if (!roomId || roomId === t('admin.private_room')) {
			const privateRoom = await pubhubsStore.createPrivateRoomWith([ask.value.user.userId]);
			roomId = privateRoom!.room_id;
		}
		const result: AskDisclosureMessage = {
			userId: ask.value.user?.userId,
			replyToRoomId: roomId,
			message: ask.value.message,
			attributes: ask.value.attributes,
		};
		// Message is duplicated in body and in 'ask' object.
		await pubhubsStore.addAskDisclosureMessage(roomId, result.message, result);
		close();
	}
</script>
