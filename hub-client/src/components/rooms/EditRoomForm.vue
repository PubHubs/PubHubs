<template>
	<ValidatedForm @keydown.enter.stop v-slot="{ isValidated }" class="p-200">
		<TextField v-model="editRoom.name" :validation="{ required: true, maxLength: roomValidations.maxNameLength }" :placeholder="t('admin.name_placeholder')" :show-length="true">{{ t('admin.name') }}</TextField>
		<TextField v-model="editRoom.topic" :validation="{ maxLength: roomValidations.maxTopicLength }" :placeholder="t('admin.topic_placeholder')" :show-length="true">{{ t('admin.topic') }}</TextField>
		<TextField v-if="!secured" v-model="editRoom.type" :validation="{ maxLength: roomValidations.maxTypeLength }" :placeholder="t('admin.room_type_placeholder')" :show-length="true">{{ t('admin.room_type') }}</TextField>

		<div v-if="secured">
			<TextField v-model="editRoom.user_txt" :validation="{ maxLength: roomValidations.maxDescriptionLength }" :placeholder="t('admin.secured_description_placeholder')" :show-length="true">{{
				t('admin.secured_description')
			}}</TextField>

			<div>
				<div class="mt-4 flex flex-wrap gap-2">
					<Label :required="true">{{ t('admin.secured_yivi_attributes') }}</Label>
					<button v-for="(attr, index) in selectedAttributes" :key="index" :class="['rounded-xs px-3 py-1', activeTab === index ? 'bg-surface-high' : 'bg-surface text-on-surface']" @click="activeTab = index" type="button">
						{{ attr.label ? attr.label : index + 1 }}
						<span v-if="selectedAttributes.length > 1" @click.stop="removeAttribute(index)" class="text-accent-red hover:text-on-accent-red ml-2 cursor-pointer">&times;</span>
					</button>
					<Button v-if="selectedAttributes.length < roomValidations.maxAttributes" icon="plus" size="sm" @click="selectedAttributes.push({ label: '', attribute: '', accepted: [], profile: false })"></Button>
				</div>

				<div v-if="selectedAttributes.length" class="bg-surface-low border-2 p-4">
					<TextFieldAutoComplete v-model="selectedAttributes[activeTab].label" :options="yiviAttributes" :maxlength="autoCompleteLength" class="text-label placeholder:text-surface-subtle">{{
						t('admin.secured_attribute')
					}}</TextFieldAutoComplete>

					<div class="flex gap-100">
						<div class="grow">
							<TextArea v-model="valuesString" :placeholder="t('admin.add_tip')" @keydown.enter.prevent="addUniqueValue(activeTab)">{{ t('admin.add_value') }}</TextArea>
						</div>
						<div class="grow">
							<Button class="mt-300" @click="addUniqueValue(activeTab)">{{ t('admin.add') }}</Button>
						</div>
					</div>

					<div v-if="selectedAttributes[activeTab].accepted.length > 0" class="mb-200 flex flex-wrap gap-2">
						<Label>{{ t('admin.secured_values') }}</Label>
						<span v-for="(value, index) in selectedAttributes[activeTab].accepted" :key="index" class="bg-primary text-on-primary bg-surface inline-flex items-center truncate rounded-xl px-2 py-1">
							{{ value }}
							<button type="button" class="text-accent-red hover:text-on-accent-red ml-2" @click="selectedAttributes[activeTab].accepted.splice(index, 1)">&times;</button>
						</span>
					</div>

					<Checkbox v-model="selectedAttributes[activeTab].profile">{{ t('admin.secured_profile') }}</Checkbox>
				</div>
			</div>
		</div>

		<ButtonGroup>
			<Button variant="error" @click.stop.prevent="cancel()">{{ t('dialog.cancel') }}</Button>
			<Button type="submit" :disabled="!isValidated" @click.stop.prevent="submitRoom()">{{ t('dialog.edit') }}</Button>
		</ButtonGroup>
	</ValidatedForm>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Composables
	import { useEditRoom } from '@hub-client/composables/useEditRoom';
	import { useValidation } from '@hub-client/composables/useValidation';

	// Logic
	import { isEmpty, trimSplit } from '@hub-client/logic/core/extensions';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import type { TEditRoom } from '@hub-client/models/rooms/TEditRoom';
	import { TEditRoomFormAttributes } from '@hub-client/models/rooms/TEditRoom';
	import { ValidationMessage } from '@hub-client/models/validation/TValidate';

	// Stores
	import { SecuredRoomAttributes, TSecuredRoom } from '@hub-client/stores/rooms';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useYivi } from '@hub-client/stores/yivi';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	// Components
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import TextFieldAutoComplete from '@hub-client/new-design/components/forms/TextFieldAutoComplete.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	const { t } = useI18n();
	const editRoomComposable = useEditRoom();
	const validationComposable = useValidation();
	const emptyNewRoom = editRoomComposable.emptyNewRoom;

	// stores / data
	const yiviAttributes = useYivi()
		.getAttributes(t)
		.map((item) => item.label);
	const roomsStore = useRooms();

	const emit = defineEmits(['close']);

	// reactive state
	const attributeChanged = ref(false);
	const activeTab = ref(0);
	const valuesString = ref<string>('');
	const formErrors = ref<Record<string, ValidationMessage> | null>(null);
	const selectedAttributes = ref<Array<TEditRoomFormAttributes>>([{ label: '', attribute: '', accepted: [], profile: false }]);
	let OriginalAttributes: Array<TEditRoomFormAttributes> = [{ label: '', attribute: '', accepted: [], profile: false }];
	const errorMessage = ref<string | undefined>(undefined);
	const autoCompleteLength = 80;

	// editRoom typed as union; we'll narrow when submitting
	const editRoom = ref<TEditRoom | TSecuredRoom>({
		name: '',
		accepted: {} as SecuredRoomAttributes,
		topic: '',
		type: '',
		user_txt: '',
	});

	const roomValidations = {
		maxNameLength: 100,
		maxTopicLength: 100,
		maxDescriptionLength: 100,
		maxAttributes: 12,
		maxValues: 400,
		maxTypeLength: 100,
	};

	// props (use factory defaults)
	const props = defineProps({
		room: {
			type: Object,
			default: () => ({}) as unknown as TSecuredRoom | Room,
		},
		secured: {
			type: Boolean,
			default: false,
		},
	});

	const isNewRoom = computed(() => isEmpty(props.room));

	// const title = computed(() => (isNewRoom.value ? (props.secured ? t('admin.add_secured_room') : t('admin.add_room')) : props.secured ? t('admin.edit_secured_room') : t('admin.edit_name')));

	// const dialogButtons = ref(buttonsSubmitCancel);

	onBeforeMount(() => {
		if (isNewRoom.value) {
			// New Room
			editRoom.value = { ...emptyNewRoom } as TEditRoom;
		} else {
			// Edit existing room
			editRoom.value = { ...(props.room as TSecuredRoom | Room) } as TSecuredRoom;
			editRoom.value.topic = roomsStore.getRoomTopic((props.room as any)?.room_id);

			if (props.secured) {
				const [labels, attributes] = editRoomComposable.getYiviLabelsAndAttributes((props.room as any)?.accepted, t);
				selectedAttributes.value = JSON.parse(JSON.stringify(editRoomComposable.fillInEditFormAttributes(labels, attributes, (props.room as any)?.accepted)));
				OriginalAttributes = JSON.parse(JSON.stringify(selectedAttributes.value));
			}

			watch(
				() => selectedAttributes.value,
				() => {
					errorMessage.value = t(editRoomComposable.attributesChanged(selectedAttributes.value, OriginalAttributes));
					attributeChanged.value = !isEmpty(errorMessage.value);
				},
				{ immediate: true, deep: true },
			);
		}
	});

	// const isValidated = (validated: boolean) => {
	// 	// dialogButtons.value = [
	// 	// 	{
	// 	// 		...buttonsSubmitCancel[0],
	// 	// 		enabled: validated,
	// 	// 	},
	// 	// 	buttonsSubmitCancel[1],
	// 	// ];
	// };

	// function validateRoomForm() {
	// 	const acceptedLengths = selectedAttributes.value.map((s) => s.accepted.length);
	// 	const labelLengths = selectedAttributes.value.map((s) => (s.label ? s.label.length : 0));

	// 	const acceptedMax = acceptedLengths.length ? Math.max(...acceptedLengths) : 0;
	// 	const acceptedMin = acceptedLengths.length ? Math.min(...acceptedLengths) : 0;
	// 	const labelMin = labelLengths.length ? Math.min(...labelLengths) : 0;

	// 	const values = {
	// 		name: editRoom.value.name,
	// 		topic: editRoom.value.topic,
	// 		type: editRoom.value.type ? editRoom.value.type : RoomType.PH_MESSAGES_DEFAULT,
	// 		description: props.secured ? editRoom.value.user_txt : undefined,
	// 		attributes: selectedAttributes.value,
	// 		acceptedMax,
	// 		acceptedMin,
	// 		labelMin,
	// 	};

	// 	if (props.secured) formErrors.value = validationComposable.validateBySchema(values, validationComposable.editSecuredRoomSchema);
	// 	else formErrors.value = validationComposable.validateBySchema(values, validationComposable.editPublicRoomSchema);

	// 	const hasErrors = !!formErrors.value && Object.keys(formErrors.value).length > 0;
	// 	return !hasErrors;
	// }

	function cancel() {
		emit('close');
	}

	async function submitRoom(): Promise<boolean> {
		// if (!validateRoomForm()) return false;

		if (!props.secured) {
			const room = editRoom.value as TEditRoom;
			console.info('submit', room);
			await editRoomComposable.updatePublicRoom(isNewRoom.value, room, (props.room as any)?.room_id);
		} else {
			const room = editRoom.value as TSecuredRoom;
			selectedAttributes.value = editRoomComposable.translateYiviLabelsToAttributes(selectedAttributes.value, t);
			try {
				await editRoomComposable.updateSecuredRoom(isNewRoom.value, room, selectedAttributes.value, attributeChanged.value, (props.room as any)?.room_id);
			} catch (error) {
				errorMessage.value = t((error as Error).message);
				return false;
			}
		}
		return true;
	}

	// async function close(returnValue: DialogButtonAction): Promise<void> {
	// 	if (returnValue === 0 || (returnValue === 1 && (await submitRoom()))) {
	// 		emit('close');
	// 	}
	// }

	function removeAttribute(index: number) {
		selectedAttributes.value.splice(index, 1);
		if (activeTab.value >= selectedAttributes.value.length) {
			activeTab.value = Math.max(0, selectedAttributes.value.length - 1);
		}
	}

	function addUniqueValue(tabIndex: number) {
		const acceptedValues = trimSplit(valuesString.value);
		acceptedValues.forEach((val) => {
			if (val && !selectedAttributes.value[tabIndex].accepted.includes(val)) {
				selectedAttributes.value[tabIndex].accepted.push(val);
			}
		});
		valuesString.value = '';
	}
</script>
