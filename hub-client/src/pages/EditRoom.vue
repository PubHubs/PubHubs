<template>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="flex h-full items-center gap-3">
				<Icon :type="isSecured ? 'shield' : 'chats-circle'" />
				<H3 class="text-on-surface flex">
					<TruncatedText class="font-headings font-semibold">{{ title }}</TruncatedText>
				</H3>
			</div>
		</template>

		<ValidatedForm v-if="roomLoaded" @keydown.enter.stop @validated="(v: boolean) => (isFormValidated = v)" :disabled="waitForServer" class="max-w-7000 px-400 py-200">
			<TextField v-model="editRoom.name" :validation="{ required: true, maxLength: roomValidations.maxNameLength }" :placeholder="t('admin.name_placeholder')" :show-length="true">{{ t('admin.name') }}</TextField>
			<TextField v-model="editRoom.topic" :validation="{ maxLength: roomValidations.maxTopicLength }" :placeholder="t('admin.topic_placeholder')" :show-length="true">{{ t('admin.topic') }}</TextField>
			<TextField v-if="!isSecured" v-model="editRoom.type" :validation="{ maxLength: roomValidations.maxTypeLength }" :placeholder="t('admin.room_type_placeholder')" :show-length="true">{{ t('admin.room_type') }}</TextField>

			<div v-if="isSecured" class="pb-200">
				<TextField v-model="editRoom.user_txt" :validation="{ required: true, maxLength: roomValidations.maxDescriptionLength }" :placeholder="t('admin.secured_description_placeholder')" :show-length="true">{{
					t('admin.secured_description')
				}}</TextField>

				<div>
					<ValidateField v-model="selectedAttributes" :validation="{ required: true, custom: validateAttributes() }">
						<Label class="pb-100">{{ t('admin.secured_yivi_attributes') }}</Label>
						<div class="flex flex-wrap gap-200">
							<Tabs v-slot="{ activeTab, setActiveTab }">
								<TabHeader>
									<TabPill v-for="(attr, index) in selectedAttributes" :value="index">
										{{ attr.label ? attr.label : index + 1 }}
										<button
											v-if="selectedAttributes.length > 1"
											type="button"
											class="text-button-red ml-050 -mr-100 cursor-pointer"
											tabindex="-1"
											:title="t('admin.remove_attribute')"
											@click.stop="
												removeAttribute(index);
												setActiveTab(0);
											"
										>
											<Icon type="x" size="sm" />
										</button>
									</TabPill>
									<TabPill
										v-if="selectedAttributes.length < roomValidations.maxAttributes && allAttributesValid"
										@select="
											addAttribute();
											setActiveTab(selectedAttributes.length - 1);
										"
									>
										<Icon type="plus" size="sm" />
									</TabPill>
								</TabHeader>
								<TabContainer>
									<div role="tabpanel" v-if="selectedAttributes[activeTab]" class="flex flex-col gap-100">
										<DropDown v-model="selectedAttributes[activeTab].label" :options="yiviAttributes" :filtered="true" class="text-label placeholder:text-surface-subtle">{{ t('admin.secured_attribute') }}</DropDown>

										<!-- Add values -->
										<div class="my-100 flex grow items-end gap-100">
											<TextField v-model="valuesString" :placeholder="t('admin.add_tip')" @keydown.enter.prevent="addUniqueValue(activeTab)">{{ t('admin.add_value') }}</TextField>
											<Button :title="t('admin.add')" @click="addUniqueValue(activeTab)" class="mb-050">{{ t('admin.add') }}</Button>
										</div>

										<!-- Values -->
										<div v-if="selectedAttributes[activeTab].accepted.length > 0" class="pb-200">
											<Label>{{ t('admin.secured_values') }}</Label>

											<div v-if="selectedAttributes[activeTab].accepted.length > 0" class="flex max-h-2000 w-full flex-wrap justify-start gap-100 overflow-y-scroll">
												<span v-for="(value, index) in selectedAttributes[activeTab].accepted" :key="index" class="group bg-surface text-on-primary py-050 gap-050 inline-flex items-center rounded-xl px-100">
													{{ value }}
													<button
														type="button"
														class="group-hover:text-button-red cursor-pointer"
														:title="t('admin.remove_value')"
														@click="
															selectedAttributes[activeTab].accepted.splice(index, 1);
															attributeChanged = true;
														"
													>
														<Icon type="x" size="sm" />
													</button>
												</span>
											</div>
										</div>

										<Checkbox v-model="selectedAttributes[activeTab].profile" class="pb-100">{{ t('admin.secured_profile') }}</Checkbox>
									</div>
								</TabContainer>
							</Tabs>
						</div>
					</ValidateField>
				</div>
			</div>
		</ValidatedForm>

		<!-- Fixed action buttons -->
		<div class="fixed right-10 bottom-5 z-20 flex items-center gap-200">
			<Button variant="error" @click.stop.prevent="back()">{{ t('dialog.cancel') }}</Button>
			<Button :disabled="!isFormValidated" :loading="waitForServer" @click.stop.prevent="submitRoom()">{{ t('forms.save') }}</Button>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import TabContainer from '@hub-client/components/ui/TabContainer.vue';
	import TabHeader from '@hub-client/components/ui/TabHeader.vue';
	import TabPill from '@hub-client/components/ui/TabPill.vue';
	import Tabs from '@hub-client/components/ui/Tabs.vue';

	// Composables
	import { useEditRoom } from '@hub-client/composables/useEditRoom';

	// Logic
	import { trimSplit } from '@hub-client/logic/core/extensions';
	import { router } from '@hub-client/logic/core/router';

	// Models
	import type { TEditRoom } from '@hub-client/models/rooms/TEditRoom';
	import { TEditRoomFormAttributes } from '@hub-client/models/rooms/TEditRoom';
	import { ValidationRule } from '@hub-client/models/validation/TValidate';

	// Stores
	import { SecuredRoomAttributes, TSecuredRoom } from '@hub-client/stores/rooms';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useYivi } from '@hub-client/stores/yivi';

	import Button from '@hub-client/new-design/components/Button.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import DropDown from '@hub-client/new-design/components/forms/DropDown.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	const { t } = useI18n();
	const rooms = useRooms();
	const editRoomComposable = useEditRoom();
	const emptyNewRoom = editRoomComposable.emptyNewRoom;

	// stores / data
	const yiviAttributes = useYivi()
		.getAttributes(t)
		.map((item) => item.label);

	// reactive state
	const allAttributesValid = computed(() => selectedAttributes.value.every((attr) => yiviAttributes.includes(attr.label) && attr.accepted.length > 0));
	const attributeChanged = ref(false);
	const isFormValidated = ref(false);
	const valuesString = ref<string>('');
	const selectedAttributes = ref<Array<TEditRoomFormAttributes>>([{ label: '', attribute: '', accepted: [], profile: false }]);
	let OriginalAttributes: Array<TEditRoomFormAttributes> = [{ label: '', attribute: '', accepted: [], profile: false }];
	const errorMessage = ref<string | undefined>(undefined);
	const roomLoaded = ref(false);
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
		return rooms.publicRoomIsSecure(props.id) || props.id === 'new_secured_room';
	});

	onBeforeMount(async () => {
		// Make sure rooms are loaded, probably they are, but not if a stewards edits
		waitForServer.value = true;
		await rooms.fetchPublicRooms();
		if (isSecured.value) {
			await rooms.getSecuredRoomInfo(props.id);
		}
		waitForServer.value = false;
		roomLoaded.value = true;

		editRoom.value = emptyNewRoom as TEditRoom;
		if (!isNewRoom.value) {
			if (isSecured.value) {
				editRoom.value = Object.assign({}, rooms.securedRoom(props.id)) as TEditRoom;
			} else {
				editRoom.value = Object.assign({}, rooms.getPublicRoom(props.id)) as unknown as TEditRoom;
			}

			if (isSecured.value) {
				const [labels, attributes] = editRoomComposable.getYiviLabelsAndAttributes((editRoom.value as any)?.accepted, t);
				selectedAttributes.value = JSON.parse(JSON.stringify(editRoomComposable.fillInEditFormAttributes(labels, attributes, (editRoom.value as any)?.accepted)));
				OriginalAttributes = JSON.parse(JSON.stringify(selectedAttributes.value));
			}
		}
	});

	async function submitRoom() {
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
				waitForServer.value = true;
				errorMessage.value = t((error as Error).message);
			}
		}
	}

	function validateAttributes() {
		let rule = {
			validator: (value: any) => {
				// Should be an array (object)
				if (typeof value !== 'object') return false;
				// Should have at least one attribute
				if (value.length < 1) return false;
				const first = value[0];
				if (!first.label || !first.accepted) return false;
				// Attribute should be an existing Yivi attribute
				if (!yiviAttributes.includes(first.label)) return false;
				// At least one accepted value for the attribute
				if (first.accepted.length < 1) return false;
				// Yes all good!
				return true;
			},
			args: [] as any[],
			message: {
				translationKey: 'rooms.incorrect_attributes',
				parameters: [],
			},
		} as ValidationRule;
		return rule;
	}

	function addAttribute() {
		selectedAttributes.value.push({ label: '', attribute: '', accepted: [], profile: false });
	}

	function removeAttribute(index: number) {
		selectedAttributes.value.splice(index, 1);
		attributeChanged.value = true;
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
