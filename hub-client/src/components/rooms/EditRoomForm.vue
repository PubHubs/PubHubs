<template>
	<Dialog
		:title="title"
		:buttons="[
			{
				...buttonsSubmitCancel[0],
				enabled: isFormValid,
			},
			buttonsSubmitCancel[1],
		]"
		@close="close($event)"
		width="w-full max-w-[960px]"
	>
		<form @keydown.enter.stop class="flex flex-col gap-4">
			<FormLine>
				<Label>{{ t('admin.name') }}</Label>
				<TextInput
					:placeholder="t('admin.name_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxNameLength"
					v-model="editRoom.name"
					class="~text-label-min/label-max placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P class="float-end ~text-label-small-min/label-small-max"> {{ editRoom.name.length }} / {{ validationComposable.roomSchemaConstants.maxNameLength }} </P>
			</FormLine>
			<FormLine>
				<Label>{{ t('admin.topic') }}</Label>
				<TextInput
					:placeholder="t('admin.topic_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxTopicLength"
					v-model="editRoom.topic"
					class="~text-label-min/label-max placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P class="float-end ~text-label-small-min/label-small-max"> {{ editRoom.topic.length }} / {{ validationComposable.roomSchemaConstants.maxTopicLength }} </P>
			</FormLine>
			<FormLine v-if="!secured">
				<Label>{{ t('admin.room_type') }}</Label>
				<TextInput
					:placeholder="t('admin.room_type_placeholder')"
					:maxlength="validationComposable.roomSchemaConstants.maxTypeLength"
					v-model="editRoom.type"
					:disabled="!isNewRoom"
					class="~text-label-min/label-max placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
				/>
				<P class="float-end ~text-label-small-min/label-small-max"> {{ editRoom.type.length }} / {{ validationComposable.roomSchemaConstants.maxTypeLength }} </P>
			</FormLine>
			<div v-if="secured">
				<FormLine class="mb-2">
					<Label>{{ t('admin.secured_description') }}</Label>
					<TextInput
						:placeholder="t('admin.secured_description_placeholder')"
						:maxlength="validationComposable.roomSchemaConstants.maxDescriptionLength"
						v-model="editRoom.user_txt"
						class="~text-label-min/label-max placeholder:text-surface-subtle focus:ring-accent-primary md:w-5/6"
					/>
					<P class="float-end ~text-label-small-min/label-small-max"> {{ editRoom.user_txt.length }} / {{ validationComposable.roomSchemaConstants.maxDescriptionLength }} </P>
				</FormLine>
				<div>
					<div class="mt-4 flex flex-wrap gap-2">
						<Label>{{ t('admin.secured_yivi_attributes') }}</Label>
						<button v-for="(attr, index) in selectedAttributes" :key="index" :class="['rounded px-3 py-1', activeTab === index ? 'bg-surface-high' : 'bg-surface text-on-surface']" @click="activeTab = index" type="button">
							{{ attr.label ? attr.label : index + 1 }}
							<span v-if="selectedAttributes.length > 1" @click.stop="removeAttribute(index)" class="ml-2 cursor-pointer text-accent-red hover:text-on-accent-red">&times;</span>
						</button>
						<Button
							v-if="selectedAttributes.length < validationComposable.roomSchemaConstants.maxAttributes"
							type="button"
							class="ml-2 rounded bg-surface px-2 py-1 text-on-surface"
							@click="selectedAttributes.push({ label: '', attribute: '', accepted: [], profile: false })"
						>
							+
						</Button>
					</div>
					<div v-if="selectedAttributes.length" class="border-2 bg-surface-low p-4">
						<FormLine class="mt-4">
							<Label>{{ t('admin.secured_attribute') }}</Label>
							<AutoComplete
								v-model="selectedAttributes[activeTab].label"
								:value="selectedAttributes[activeTab].label"
								:options="yiviAttributes"
								:maxlength="autoCompleteLength"
								class="~text-label-min/label-max placeholder:text-surface-subtle"
							/>
							<P class="float-end ~text-label-small-min/label-small-max"> {{ selectedAttributes[activeTab].label.length }} / {{ autoCompleteLength }} </P>
						</FormLine>
						<FormLine>
							<Label>{{ t('admin.add_value') }}</Label>
							<TextArea
								v-model="valuesString"
								:maxlength="3000"
								:placeholder="t('admin.add_tip')"
								@keydown.enter.prevent="addUniqueValue(activeTab)"
								class="bg-background p-2 leading-8 ~text-label-min/label-max placeholder:text-surface-subtle focus:ring-1 focus:ring-accent-primary"
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
							<span v-for="(value, index) in selectedAttributes[activeTab].accepted" :key="value" class="bg-primary text-on-primary inline-flex items-center truncate rounded-xl bg-surface px-2 py-1">
								{{ value }}
								<button type="button" class="ml-2 text-accent-red hover:text-on-accent-red" @click="selectedAttributes[activeTab].accepted.splice(index, 1)">&times;</button>
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
	// Components
	import Dialog from '@/components/ui/Dialog.vue';
	import FormLine from '@/components/forms/FormLine.vue';
	import TextInput from '@/components/forms/TextInput.vue';
	import Label from '@/components/forms/Label.vue';
	import AutoComplete from '@/components/forms/AutoComplete.vue';
	import TextArea from '@/components/forms/TextArea.vue';
	import Button from '@/components/elements/Button.vue';

	// Logic
	import { isEmpty } from '@/logic/core/extensions';
	import { buttonsSubmitCancel, DialogButtonAction } from '@/logic/store/dialog';
	import { TSecuredRoom, useRooms } from '@/logic/store/store';
	import { useEditRoom } from '@/logic/composables/useEditRoom';
	import { trimSplit } from '@/logic/core/extensions';
	import { useYivi } from '@/logic/store/yivi';
	import { useValidation } from '@/logic/validation/useValidation';

	// Model
	import Room from '@/model/rooms/Room';
	import { TEditRoomFormAttributes } from '@/model/rooms/TEditRoom';
	import { ValidationMessage } from '@/model/validation/TValidate';

	// Vue
	import { watch, computed, ref, onBeforeMount } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const editRoomComposable = useEditRoom();
	const validationComposable = useValidation();
	const emptyNewRoom = editRoomComposable.emptyNewRoom;
	const yiviAttributes = useYivi()
		.getAttributes(t)
		.map((item) => item.label);
	const roomsStore = useRooms();
	const emit = defineEmits(['close']);

	const attributeChanged = ref(false);
	const activeTab = ref(0);
	const valuesString = ref<string>('');
	const formErrors = ref<Record<string, ValidationMessage> | null>(null);
	const selectedAttributes = ref<Array<TEditRoomFormAttributes>>([{ label: '', attribute: '', accepted: [], profile: false }]);
	let OriginalAttributes = <Array<TEditRoomFormAttributes>>[{ label: '', attribute: '', accepted: [], profile: false }];
	const isFormValid = ref(false);
	let errorMessage = ref<string | undefined>(undefined);
	const autoCompleteLength = 80;
	const editRoom = ref({
		name: '',
		topic: '',
		type: '',
		user_txt: '',
	});

	const props = defineProps({
		room: {
			type: Object,
			default: ref({} as unknown as TSecuredRoom | Room),
		},
		secured: {
			type: Boolean,
			default: false,
		},
	});

	const isNewRoom = computed(() => {
		return isEmpty(props.room);
	});

	// Determines the dialog title based on whether the room is new or secured.
	const title = computed(() => (isNewRoom.value ? (props.secured ? t('admin.add_secured_room') : t('admin.add_room')) : props.secured ? t('admin.edit_secured_room') : t('admin.edit_name')));

	// Validate on any input change
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
			editRoom.value = { ...emptyNewRoom } as Room | TSecuredRoom;
		} else {
			// Edit existing room
			editRoom.value = { ...props.room } as Room | TSecuredRoom;
			editRoom.value.topic = roomsStore.getRoomTopic(props.room?.room_id);
			if (props.secured) {
				const [labels, attributes] = editRoomComposable.getYiviLabelsAndAttributes(props.room?.accepted, t);
				// Deep copy to avoid mutating props.room
				selectedAttributes.value = JSON.parse(JSON.stringify(editRoomComposable.fillInEditFormAttributes(labels, attributes, props.room?.accepted)));
				OriginalAttributes = JSON.parse(JSON.stringify(selectedAttributes.value));
			}
			// Watch if any of the original values of the room have been removed or if a new attribute has been added
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
	// Validation function
	function validateRoomForm() {
		const values = {
			name: editRoom.value.name,
			topic: editRoom.value.topic,
			type: editRoom.value.type,
			description: props.secured ? editRoom.value.user_txt : undefined,
			attributes: selectedAttributes.value,
			acceptedMax: Math.max(...selectedAttributes.value.map((maxList) => maxList.accepted.length)),
			acceptedMin: Math.min(...selectedAttributes.value.map((minList) => minList.accepted.length)),
			labelMin: Math.min(...selectedAttributes.value.map((minList) => minList.label.length)),
		};
		if (props.secured) formErrors.value = validationComposable.validateBySchema(values, validationComposable.editSecuredRoomSchema);
		else formErrors.value = validationComposable.validateBySchema(values, validationComposable.editPublicRoomSchema);
		return !formErrors.value;
	}

	async function close(returnValue: DialogButtonAction): Promise<void> {
		if (returnValue === 0 || (returnValue === 1 && (await submitRoom()))) {
			emit('close');
		}
	}
	async function submitRoom(): Promise<Boolean> {
		if (!validateRoomForm()) {
			return false;
		}
		let room = { ...editRoom.value } as TSecuredRoom;
		if (!props.secured) {
			await editRoomComposable.updatePublicRoom(isNewRoom.value, room, props.room?.room_id);
		} else {
			selectedAttributes.value = editRoomComposable.translateYiviLabelsToAttributes(selectedAttributes.value, t);
			try {
				await editRoomComposable.updateSecuredRoom(isNewRoom.value, room, selectedAttributes.value, attributeChanged.value, props.room?.room_id);
			} catch (error) {
				errorMessage.value = t((error as Error).message);
				return false;
			}
		}
		return true;
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
