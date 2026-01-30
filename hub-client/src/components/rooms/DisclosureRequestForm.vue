<template>
	<Dialog :title="$t('admin.ask_disclosure_title')" :width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'" @close="close($event)">
		<ValidatedForm @submit.prevent class="flex flex-col p-200" :class="isMobile ? 'w-full' : 'w-[450px]'" v-slot="{ isValidated }">
			<div
				class="mb-2 flex w-full flex-col gap-x-2 gap-y-1"
				@click.stop="
					selectUser = true;
					dropdown = null;
				"
			>
				<Label>{{ $t('admin.ask_disclosure_user_title') }}</Label>

				<span class="bg-background flex cursor-pointer justify-between gap-x-2 rounded-xl border p-1">
					<div class="flex flex-row items-center gap-x-2">
						<Avatar :avatar-url="userStore.userAvatar(ask.user.userId)" :user-id="ask.user.userId"></Avatar>
						<span v-if="ask.user.displayName" :title="ask.user.displayName">{{ ask.user.displayName }}</span>
					</div>
					<div class="flex items-center justify-center"><Icon type="pencil-simple" class="float-right" /></div>
				</span>
			</div>
			<ChooseFromUsersList v-if="selectUser" :header="$t('admin.ask_disclosure_choose_user')" @chosen-user="onChosenUser" @click.stop @keydown.esc.stop="selectUser = false" />

			<DropDown v-model="ask.attributes" :options="yiviAttributes" :multiple="true" :validation="{ required: true }">{{ $t('admin.secured_yivi_attributes') }}</DropDown>
			<DropDown v-model="ask.where_room" :options="roomOptions" :validation="{ required: true }">{{ $t('rooms.room') }}</DropDown>
			<TextArea placeholder="Add a message to your disclosure request" :validation="{ required: true, maxLength: 100 }" v-model="ask.message" @keydown.esc.stop>{{ $t('admin.ask_disclosure_message_title') }}</TextArea>

			<ButtonGroup>
				<Button variant="error" @click.stop.prevent="close()">{{ t('dialog.cancel') }}</Button>
				<Button type="submit" :disabled="!isValidated" @click.stop.prevent="onSubmit()">{{ t('dialog.edit') }}</Button>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import ChooseFromUsersList from '@hub-client/components/rooms/ChooseFromUsersList.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { AskDisclosure, AskDisclosureMessage } from '@hub-client/models/components/signedMessages';
	import { TUserAccount } from '@hub-client/models/users/TUser';
	import { Attribute } from '@hub-client/models/yivi/Tyivi';

	// Stores
	// import { DialogButtonAction, buttonsSubmitCancel } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { User, useUser } from '@hub-client/stores/user';
	import { useYivi } from '@hub-client/stores/yivi';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import DropDown from '@hub-client/new-design/components/forms/DropDown.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextFieldAutoComplete from '@hub-client/new-design/components/forms/TextFieldAutoComplete.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	const yiviStore = useYivi();
	const userStore = useUser();
	const roomsStore = useRooms();
	const pubhubsStore = usePubhubsStore();

	const { t } = useI18n();
	const emit = defineEmits(['close']);
	// const attribute = ref<string>('');
	const selectUser = ref<boolean>(false);
	const dropdown = ref<string | null>('notNull');
	const yiviAttributes = yiviStore.getAttributes(t).map((item) => item.label);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const props = defineProps<{
		user: TUserAccount;
	}>();

	// // Validation
	// const validationComposable = useValidation();
	// const formErrors = ref<Record<string, ValidationMessage> | null>(null);

	// // Customizable validation schema for each form that needs validation
	// const disclosureConstants = {
	// 	maxAttributesLength: 5,
	// };
	// const askDisclosureSchema: ValidationSchema = {
	// 	attributes: [
	// 		{ validator: validateRequired, args: ['admin.secured_yivi_attributes'], message: requiredMessage },
	// 		{ validator: validateMaxLength, args: [disclosureConstants.maxAttributesLength, 'admin.secured_yivi_attributes'], message: maxItemsMessage },
	// 	],
	// };

	const ask = ref<AskDisclosure>({
		user: { userId: '' },
		message: '',
		attributes: [t('attribute.pbdf.sidn-pbdf.email.email')],
		where_room: '', //t('admin.private_room'),
	});

	const roomOptions = computed(() => {
		return roomsStore.publicRooms.map((room) => ({
			value: room.room_id,
			label: room.name || room.room_id,
		}));
	});

	// function validateRoomForm() {
	// 	const values = {
	// 		attributes: ask.value?.attributes,
	// 	};

	// 	// formErrors.value = validationComposable.validateBySchema(values, validationComposable.askDisclosureSchema);
	// }

	// function addAttribute() {
	// 	if (attribute.value && ask.value && !ask.value.attributes.includes(attribute.value)) {
	// 		if (yiviStore.getAttributes(t).find((attr: Attribute) => attr.label === attribute.value.trim())) {
	// 			ask.value.attributes.push(attribute.value);

	// 			// validateRoomForm();
	// 		} else {
	// 			// if (!formErrors.value) {
	// 			// 	formErrors.value = {};
	// 			// }
	// 			// formErrors.value['invalidAttribute'] = {
	// 			// 	translationKey: 'admin.error_invalid_attribute',
	// 			// 	parameters: [attribute.value],
	// 			// };
	// 		}
	// 	}
	// 	attribute.value = '';
	// }

	// function removeAttribute(index: number) {
	// 	if (ask.value) {
	// 		ask.value.attributes.splice(index, 1);
	// 		// validateRoomForm();
	// 	}
	// }

	onBeforeMount(async () => {
		await roomsStore.fetchPublicRooms();
		ask.value.user = {
			userId: props.user.name,
			displayName: props.user.displayname,
		};
	});

	async function close() {
		emit('close');
	}

	function onChosenUser(other: User) {
		selectUser.value = false;
		ask.value.user = {
			userId: other.userId,
			displayName: other.displayName,
		};
	}

	async function onSubmit() {
		const privateRoom = await pubhubsStore.createPrivateRoomWith(ask.value.user as User);
		const privateRoomId = privateRoom!.room_id;
		const result: AskDisclosureMessage = {
			userId: ask.value.user?.userId,
			replyToRoomId: ask.value.where_room || privateRoomId,
			message: ask.value.message,
			attributes: ask.value.attributes,
		};
		// Message is duplicated in body and in 'ask' object.
		await pubhubsStore.addAskDisclosureMessage(privateRoomId, result.message, result);
	}
</script>
