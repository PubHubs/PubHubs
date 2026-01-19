<template>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="text-on-surface-dim hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ $t('admin.title_administrator') }}</span>
				<hr class="bg-on-surface-dim h-[2px] grow" />
			</div>
			<div class="flex h-full items-center">
				<div class="flex w-fit items-center gap-3">
					<Icon type="caret-left" data-testid="back" class="cursor-pointer" @click.stop="back()" />
					<H3 class="font-headings text-on-surface font-semibold">{{ title }}</H3>
				</div>
			</div>
		</template>

		<ValidatedForm @keydown.enter.stop v-slot="{ isValidated }" :disabled="waitForServer" class="p-200">
			<TextField v-model="editRoom.name" :validation="{ required: true, maxLength: roomValidations.maxNameLength }" :placeholder="t('admin.name_placeholder')" :show-length="true">{{ t('admin.name') }}</TextField>
			<TextField v-model="editRoom.topic" :validation="{ maxLength: roomValidations.maxTopicLength }" :placeholder="t('admin.topic_placeholder')" :show-length="true">{{ t('admin.topic') }}</TextField>
			<TextField v-if="!isSecured" v-model="editRoom.type" :validation="{ maxLength: roomValidations.maxTypeLength }" :placeholder="t('admin.room_type_placeholder')" :show-length="true">{{ t('admin.room_type') }}</TextField>

			<div v-if="isSecured">
				<TextField v-model="editRoom.user_txt" :validation="{ maxLength: roomValidations.maxDescriptionLength }" :placeholder="t('admin.secured_description_placeholder')" :show-length="true">{{
					t('admin.secured_description')
				}}</TextField>

				<div>
					<div class="mt-4 flex flex-wrap gap-2">
						<Label :required="true">{{ t('admin.secured_yivi_attributes') }}</Label>

						<Tabs v-slot="{ activeTab, setActiveTab }">
							<TabHeader>
								<TabPill v-for="(attr, index) in selectedAttributes">
									{{ attr.label ? attr.label : index + 1 }}
									<IconButton
										v-if="selectedAttributes.length > 1 && index > 0"
										size="sm"
										icon="trash"
										class="text-on-accent-red -mr-200 ml-100"
										@click.stop="
											removeAttribute(index);
											setActiveTab(1);
										"
										:nofocus="true"
									></IconButton>
								</TabPill>
								<IconButton
									v-if="selectedAttributes.length < roomValidations.maxAttributes"
									variant="tertiary"
									icon="plus"
									size="sm"
									class="cursor-pointer"
									:nofocus="true"
									@click.stop="
										addAttribute();
										setActiveTab(activeTab + 1);
									"
								></IconButton>
							</TabHeader>
							<TabContainer>
								<div class="pt-2" role="tabpanel" v-if="selectedAttributes.length >= activeTab">
									<TextFieldAutoComplete v-model="selectedAttributes[activeTab - 1].label" :options="yiviAttributes" :maxlength="autoCompleteLength" class="text-label placeholder:text-surface-subtle">{{
										t('admin.secured_attribute')
									}}</TextFieldAutoComplete>

									<Label>{{ t('admin.secured_values') }}</Label>
									<div class="bg-on-surface-disabled mb-100 rounded p-100">
										<div v-if="selectedAttributes[activeTab - 1].accepted.length > 0" class="bg-surface-base outline-offset-thin outline-on-surface-dim p-050 flex w-full justify-start gap-100 rounded outline">
											<span v-for="(value, index) in selectedAttributes[activeTab - 1].accepted" :key="index" class="bg-surface-elevated text-on-primary inline-flex items-center truncate rounded-xl px-2 py-1">
												{{ value }}
												<IconButton size="sm" icon="trash" class="text-on-accent-red ml-025" @click="selectedAttributes[activeTab - 1].accepted.splice(index, 1)"></IconButton>
											</span>
										</div>

										<div class="mt-100 flex gap-100">
											<div class="grow">
												<TextArea v-model="valuesString" :placeholder="t('admin.add_tip')" @keydown.enter.prevent="addUniqueValue(activeTab - 1)">{{ t('admin.add_value') }}</TextArea>
											</div>
											<div>
												<Button class="mt-300" @click="addUniqueValue(activeTab - 1)">{{ t('admin.add') }}</Button>
											</div>
										</div>
									</div>

									<Checkbox v-model="selectedAttributes[activeTab - 1].profile">{{ t('admin.secured_profile') }}</Checkbox>
								</div>
							</TabContainer>
						</Tabs>
					</div>
				</div>
			</div>

			<ButtonGroup>
				<Button variant="error" @click.stop.prevent="back()">{{ t('dialog.cancel') }}</Button>
				<Button type="submit" :disabled="!isValidated" @click.stop.prevent="submitRoom()">{{ t('dialog.edit') }}</Button>
			</ButtonGroup>
		</ValidatedForm>

		<div v-if="waitForServer" class="mt-200 flex w-full">
			<div class="mx-auto">
				<InlineSpinner></InlineSpinner>
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import TabContainer from '@hub-client/components/ui/TabContainer.vue';
	import TabHeader from '@hub-client/components/ui/TabHeader.vue';
	import TabPill from '@hub-client/components/ui/TabPill.vue';
	import Tabs from '@hub-client/components/ui/Tabs.vue';

	// Composables
	import { useEditRoom } from '@hub-client/composables/useEditRoom';
	import { useValidation } from '@hub-client/composables/useValidation';

	// Logic
	import { trimSplit } from '@hub-client/logic/core/extensions';
	import { router } from '@hub-client/logic/core/router';

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
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import TextFieldAutoComplete from '@hub-client/new-design/components/forms/TextFieldAutoComplete.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	const { t } = useI18n();
	const rooms = useRooms();
	const editRoomComposable = useEditRoom();
	const validationComposable = useValidation();
	const emptyNewRoom = editRoomComposable.emptyNewRoom;

	// stores / data
	const yiviAttributes = useYivi()
		.getAttributes(t)
		.map((item) => item.label);

	// reactive state
	const attributeChanged = ref(false);
	// const activeTab = ref(0);
	const valuesString = ref<string>('');
	const formErrors = ref<Record<string, ValidationMessage> | null>(null);
	const selectedAttributes = ref<Array<TEditRoomFormAttributes>>([{ label: '', attribute: '', accepted: [], profile: false }]);
	let OriginalAttributes: Array<TEditRoomFormAttributes> = [{ label: '', attribute: '', accepted: [], profile: false }];
	const errorMessage = ref<string | undefined>(undefined);
	const autoCompleteLength = 80;
	const waitForServer = ref(false);

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

	// Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	const title = computed(() => (isNewRoom.value ? (isSecured.value ? t('admin.add_secured_room') : t('admin.add_room')) : isSecured.value ? t('admin.edit_secured_room') : t('admin.edit_name')));

	const isNewRoom = computed(() => {
		return props.id === 'new_room' || props.id === 'new_secured_room';
	});

	const isSecured = computed(() => {
		return rooms.roomIsSecure(props.id) || props.id === 'new_secured_room';
	});

	onBeforeMount(() => {
		editRoom.value = emptyNewRoom as TEditRoom;
		if (!isNewRoom.value) {
			if (isSecured.value) {
				editRoom.value = Object.assign({}, rooms.securedRoom(props.id)) as TEditRoom;
			} else {
				editRoom.value = Object.assign({}, rooms.room(props.id)?.matrixRoom) as unknown as TEditRoom;
			}

			editRoom.value.topic = rooms.getRoomTopic(props.id);

			if (isSecured.value) {
				const [labels, attributes] = editRoomComposable.getYiviLabelsAndAttributes((editRoom.value as any)?.accepted, t);
				selectedAttributes.value = JSON.parse(JSON.stringify(editRoomComposable.fillInEditFormAttributes(labels, attributes, (editRoom.value as any)?.accepted)));
				OriginalAttributes = JSON.parse(JSON.stringify(selectedAttributes.value));
				console.info('SECURED', labels, attributes, selectedAttributes.value);
			}
		}
		// 		watch(
		// 			() => selectedAttributes.value,
		// 			() => {
		// 				errorMessage.value = t(editRoomComposable.attributesChanged(selectedAttributes.value, OriginalAttributes));
		// 				attributeChanged.value = !isEmpty(errorMessage.value);
		// 			},
		// 			{ immediate: true, deep: true },
		// 		);
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

	async function submitRoom() {
		// if (!validateRoomForm()) return false;

		if (!isSecured.value) {
			waitForServer.value = true;
			await editRoomComposable.updatePublicRoom(isNewRoom.value, editRoom.value as TEditRoom, props.id);
			back();
		} else {
			selectedAttributes.value = editRoomComposable.translateYiviLabelsToAttributes(selectedAttributes.value, t);
			try {
				waitForServer.value = true;
				await editRoomComposable.updateSecuredRoom(isNewRoom.value, editRoom.value as TEditRoom, selectedAttributes.value, attributeChanged.value, props.id);
				back();
			} catch (error) {
				errorMessage.value = t((error as Error).message);
			}
		}
	}

	function addAttribute() {
		selectedAttributes.value.push({ label: '', attribute: '', accepted: [], profile: false });
	}

	function removeAttribute(index: number) {
		selectedAttributes.value.splice(index, 1);
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

	function back() {
		router.back();
	}
</script>
