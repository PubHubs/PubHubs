<template>
	<Dialog :title="title" :buttons="dialogButtons" @close="close($event)" width="w-full max-w-[960px]">
		<form @keydown.enter.stop class="flex flex-col gap-4">
			<FormLine>
				<Label>{{ t('admin.name') }}</Label>
				<TextInput
					:placeholder="t('admin.name_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxNameLength"
					v-model="editRoom.name"
					class="text-label placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P class="text-label-small float-end"> {{ editRoom.name?.length ?? 0 }} / {{ validationComposable.roomSchemaConstants.maxNameLength }} </P>
			</FormLine>

			<FormLine>
				<Label>{{ t('admin.topic') }}</Label>
				<TextInput
					:placeholder="t('admin.topic_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxTopicLength"
					v-model="editRoom.topic"
					class="text-label placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P class="text-label-small float-end"> {{ editRoom.topic?.length ?? 0 }} / {{ validationComposable.roomSchemaConstants.maxTopicLength }} </P>
			</FormLine>

			<FormLine v-if="!secured">
				<Label>{{ t('admin.room_type') }}</Label>
				<TextInput
					:placeholder="t('admin.room_type_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxTypeLength"
					v-model="editRoom.type"
					:disabled="!isNewRoom"
					class="text-label placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P v-if="editRoom.type" class="text-label-small float-end"> {{ editRoom.type?.length ?? 0 }} / {{ validationComposable.roomSchemaConstants.maxTypeLength }} </P>
			</FormLine>

			<div v-if="secured">
				<FormLine class="mb-2">
					<Label>{{ t('admin.secured_description') }}</Label>
					<TextInput
						:placeholder="t('admin.secured_description_placeholder')"
						:maxlength="validationComposable.roomSchemaConstants.maxDescriptionLength"
						v-model="editRoom.user_txt"
						class="text-label placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
					/>
					<P class="text-label-small float-end"> {{ editRoom.user_txt?.length ?? 0 }} / {{ validationComposable.roomSchemaConstants.maxDescriptionLength }} </P>
				</FormLine>
				<div>
					<div class="mt-4 flex flex-wrap gap-2">
						<Label>{{ t('admin.secured_yivi_attributes') }}</Label>
						<button v-for="(attr, index) in selectedAttributes" :key="index" :class="['rounded-xs px-3 py-1', activeTab === index ? 'bg-surface-high' : 'bg-surface text-on-surface']" @click="activeTab = index" type="button">
							{{ attr.label ? attr.label : index + 1 }}
							<span v-if="selectedAttributes.length > 1" @click.stop="removeAttribute(index)" class="text-accent-red hover:text-on-accent-red ml-2 cursor-pointer">&times;</span>
						</button>
						<Button
							v-if="selectedAttributes.length < validationComposable.roomSchemaConstants.maxAttributes"
							type="button"
							class="bg-surface text-on-surface ml-2 rounded-xs px-2 py-1"
							@click="selectedAttributes.push({ label: '', attribute: '', accepted: [], profile: false })"
						>
							+
						</Button>
					</div>

					<div v-if="selectedAttributes.length" class="bg-surface-low border-2 p-4">
						<FormLine class="mt-4">
							<Label>{{ t('admin.secured_attribute') }}</Label>
							<AutoComplete v-model="selectedAttributes[activeTab].label" :options="yiviAttributes" :maxlength="autoCompleteLength" class="text-label placeholder:text-surface-subtle" />
							<P class="text-label-small float-end"> {{ selectedAttributes[activeTab].label.length }} / {{ autoCompleteLength }} </P>
						</FormLine>

						<FormLine>
							<Label>{{ t('admin.add_value') }}</Label>
							<TextArea
								v-model="valuesString"
								:maxlength="3000"
								:placeholder="t('admin.add_tip')"
								@keydown.enter.prevent="addUniqueValue(activeTab)"
								class="bg-background text-label placeholder:text-surface-subtle focus:ring-accent-primary p-2 leading-8 focus:ring-1"
							/>
							<Button @click="addUniqueValue(activeTab)">{{ t('admin.add') }}</Button>
						</FormLine>
						<FormLine>
							<Label>{{ t('admin.secured_profile') }}</Label>
							<div class="flex w-full items-center justify-start">
								<input type="checkbox" v-model="selectedAttributes[activeTab].profile" class="scale-150" />
							</div>
						</FormLine>

						<div class="mt-2 flex flex-wrap gap-2">
							<Label>{{ t('admin.secured_values') }}</Label>
							<span v-for="(value, index) in selectedAttributes[activeTab].accepted" :key="index" class="bg-primary text-on-primary bg-surface inline-flex items-center truncate rounded-xl px-2 py-1">
								{{ value }}
								<button type="button" class="text-accent-red hover:text-on-accent-red ml-2" @click="selectedAttributes[activeTab].accepted.splice(index, 1)">&times;</button>
							</span>
						</div>
					</div>
				</div>
			</div>

			<div v-if="errorMessage" class="mt-4">
				<P class="text-accent-red">{{ errorMessage }}</P>
			</div>

			<div v-if="formErrors && Object.keys(formErrors).length" class="mt-4">
				<P class="text-accent-red">
					{{
						Object.values(formErrors)
							.map((error) =>
								t(
									error.translationKey,
									error.parameters.map((param) => t(param)),
								),
							)
							.join(', ')
					}}
				</P>
			</div>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import P from '@hub-client/components/elements/P.vue';
	import AutoComplete from '@hub-client/components/forms/AutoComplete.vue';
	import FormLine from '@hub-client/components/forms/FormLine.vue';
	import Label from '@hub-client/components/forms/Label.vue';
	import TextArea from '@hub-client/components/forms/TextArea.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { useEditRoom } from '@hub-client/composables/useEditRoom';
	import { useValidation } from '@hub-client/composables/useValidation';

	// Logic
	import { isEmpty, trimSplit } from '@hub-client/logic/core/extensions';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	import type { TEditRoom } from '@hub-client/models/rooms/TEditRoom';
	import { TEditRoomFormAttributes } from '@hub-client/models/rooms/TEditRoom';
	import { ValidationMessage } from '@hub-client/models/validation/TValidate';

	// Stores
	import { DialogButtonAction, buttonsSubmitCancel } from '@hub-client/stores/dialog';
	import { TSecuredRoom } from '@hub-client/stores/rooms';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useYivi } from '@hub-client/stores/yivi';

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
	const isFormValid = ref(false);
	const errorMessage = ref<string | undefined>(undefined);
	const autoCompleteLength = 80;

	// editRoom typed as union; we'll narrow when submitting
	const editRoom = ref<TEditRoom | TSecuredRoom>({
		name: '',
		topic: '',
		type: '',
		user_txt: '',
	});

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

	const title = computed(() => (isNewRoom.value ? (props.secured ? t('admin.add_secured_room') : t('admin.add_room')) : props.secured ? t('admin.edit_secured_room') : t('admin.edit_name')));

	const dialogButtons = computed(() => [
		{
			...buttonsSubmitCancel[0],
			enabled: isFormValid.value,
		},
		buttonsSubmitCancel[1],
	]);

	// validation watcher
	watch(
		[() => editRoom.value.name, () => editRoom.value.topic, () => editRoom.value.type, () => editRoom.value.user_txt, () => selectedAttributes.value],
		() => {
			isFormValid.value = validateRoomForm();
		},
		{ immediate: true, deep: true },
	);

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

	function validateRoomForm() {
		const acceptedLengths = selectedAttributes.value.map((s) => s.accepted.length);
		const labelLengths = selectedAttributes.value.map((s) => (s.label ? s.label.length : 0));

		const acceptedMax = acceptedLengths.length ? Math.max(...acceptedLengths) : 0;
		const acceptedMin = acceptedLengths.length ? Math.min(...acceptedLengths) : 0;
		const labelMin = labelLengths.length ? Math.min(...labelLengths) : 0;

		const values = {
			name: editRoom.value.name,
			topic: editRoom.value.topic,
			type: editRoom.value.type ? editRoom.value.type : RoomType.PH_MESSAGES_DEFAULT,
			description: props.secured ? editRoom.value.user_txt : undefined,
			attributes: selectedAttributes.value,
			acceptedMax,
			acceptedMin,
			labelMin,
		};

		if (props.secured) formErrors.value = validationComposable.validateBySchema(values, validationComposable.editSecuredRoomSchema);
		else formErrors.value = validationComposable.validateBySchema(values, validationComposable.editPublicRoomSchema);

		const hasErrors = !!formErrors.value && Object.keys(formErrors.value).length > 0;
		return !hasErrors;
	}

	async function submitRoom(): Promise<boolean> {
		if (!validateRoomForm()) return false;

		if (!props.secured) {
			const room = editRoom.value as TEditRoom;
			await editRoomComposable.updatePublicRoom(isNewRoom.value, room, props.room.room_id);
		} else {
			const room = editRoom.value as TSecuredRoom;
			selectedAttributes.value = editRoomComposable.translateYiviLabelsToAttributes(selectedAttributes.value, t);
			try {
				await editRoomComposable.updateSecuredRoom(isNewRoom.value, room, selectedAttributes.value, attributeChanged.value, props.room.room_id);
			} catch (error) {
				errorMessage.value = t((error as Error).message);
				return false;
			}
		}
		return true;
	}

	async function close(returnValue: DialogButtonAction): Promise<void> {
		if (returnValue === 0 || (returnValue === 1 && (await submitRoom()))) {
			emit('close');
		}
	}

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
