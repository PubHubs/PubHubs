<!--
 TODO
 This is temporarily changed so attributes can be changed after entering (but not removed)
 Because of the fact that a FormObjectInput does not handle the submit button correctly yet the button is always enabled (by removing setSubmitButton(dialog.properties.buttons[0]);)
 -->

<template>
	<Dialog :title="title" :buttons="buttonsSubmitCancel" @close="close($event)" width="w-full max-w-[960px]">
		<form @submit.prevent class="flex flex-col gap-4">
			<FormLine>
				<Label>{{ $t('admin.name') }}</Label>
				<TextInput :placeholder="$t('admin.name')" v-model="editRoom.name" class="md:w-5/6" @changed="updateData('name', $event)"></TextInput>
			</FormLine>
			<FormLine>
				<Label>{{ $t('admin.topic') }}</Label>
				<TextInput :placeholder="$t('admin.topic')" v-model="editRoom.topic" class="md:w-5/6" @changed="updateData('topic', $event)"></TextInput>
			</FormLine>
			<FormLine v-if="!secured">
				<Label>{{ $t('admin.room_type') }}</Label>
				<TextInput :placeholder="$t('admin.room_type_placeholder')" v-model="editRoom.type" class="md:w-5/6" @changed="updateData('type', $event)"></TextInput>
			</FormLine>
			<div v-if="secured">
				<FormLine class="mb-2">
					<Label>{{ $t('admin.secured_description') }}</Label>
					<TextInput :placeholder="$t('admin.secured_description')" v-model="editRoom.user_txt" class="md:w-5/6"></TextInput>
				</FormLine>
				<FormLine>
					<Label>{{ $t('admin.secured_yivi_attributes') }}</Label>
					<FormObjectInput v-if="editRoom.accepted" :template="securedRoomTemplate" :canAdd="isNewRoom" :canRemove="isNewRoom" v-model="(editRoom as TSecuredRoom).accepted"> </FormObjectInput>
				</FormLine>
			</div>
			<div v-if="errorMessage">
				<Label>{{ errorMessage }}</Label>
			</div>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
	// Components
	import Dialog from '../ui/Dialog.vue';
	import FormLine from '../forms/FormLine.vue';
	import TextInput from '../forms/TextInput.vue';
	import Label from '../forms/Label.vue';
	import FormObjectInput from '../forms/FormObjectInput.vue';

	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';
	import { useFormState } from '@/composables/useFormState';
	import { isEmpty, trimSplit } from '@/core/extensions';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { buttonsSubmitCancel, DialogButtonAction } from '@/store/dialog';
	import { RoomType } from '@/store/rooms';
	import { SecuredRoomAttributes, TSecuredRoom, useRooms } from '@/store/store';
	import Room from '@/model/rooms/Room';

	import { useYivi } from '@/store/yivi';
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const { setData, updateData } = useFormState();
	const pubhubs = usePubHubs();
	const rooms = useRooms();

	//const dialog = useDialog();
	const yivi = useYivi();
	const emit = defineEmits(['close']);

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

	let errorMessage = ref<string | undefined>(undefined);

	// used to check if no attribute values have been deleted after editing
	let previousAccepted: SecuredRoomAttributes;

	//#region Computed properties

	const isNewRoom = computed(() => {
		return isEmpty(props.room);
	});

	const title = computed(() => {
		if (isNewRoom.value) {
			if (props.secured) {
				return t('admin.add_secured_room');
			} else {
				return t('admin.add_room');
			}
		}
		if (props.secured) {
			return t('admin.edit_secured_room');
		}
		return t('admin.edit_name');
	});

	//#region types & defaults

	interface SecuredRoomAttributesObject {
		yivi_attribute: string;
		accepted_values: Array<string>;
		profile: boolean;
	}

	const emptyNewRoom = {
		name: '',
		topic: '',
		accepted: [] as Array<SecuredRoomAttributesObject>,
		user_txt: '',
		type: '',
	} as TSecuredRoom;

	const editRoom = ref({} as Room | TSecuredRoom);

	const securedRoomTemplate = ref([
		{ key: 'yivi', label: t('admin.secured_attribute'), type: 'autocomplete', options: [], default: '', disabled: !isNewRoom.value },
		{ key: 'values', label: t('admin.secured_values'), type: 'textarea', default: '', maxLength: 3000 },
		{ key: 'profile', label: t('admin.secured_profile'), type: 'checkbox', default: false },
	] as Array<FormObjectInputTemplate>);

	//#region mount
	onBeforeMount(async () => {
		// yivi attributes
		await yivi.fetchAttributes();
		securedRoomTemplate.value[0].options = yivi.attributesOptions;

		if (isNewRoom.value) {
			// New Room
			editRoom.value = { ...emptyNewRoom } as Room | TSecuredRoom;
		} else {
			// Edit room

			editRoom.value = { ...(props.room as Room | TSecuredRoom) };
			editRoom.value.topic = rooms.getRoomTopic(props.room.room_id);
			// Transform for form
			if (props.secured) {
				// Remove 'profile' for existing secured room (cant be edited after creation)
				securedRoomTemplate.value.splice(2, 1);
				previousAccepted = editRoom.value.accepted;
				let accepted = editRoom.value.accepted;
				if (accepted !== undefined) {
					// FormObjectInput needs a different structure of the accepted values, transform them
					const acceptedKeys = Object.keys(accepted);
					let newAccepted = [];
					acceptedKeys.forEach((key) => {
						let values = accepted[key].accepted_values;
						if (typeof values === 'object') {
							values = values.join(', ');
						}
						newAccepted.push({
							yivi: key,
							values: values,
							profile: accepted[key].profile,
						});
					});
					editRoom.value.accepted = newAccepted;
				}
			}
		}

		//setSubmitButton(dialog.properties.buttons[0]);

		setData({
			name: {
				value: editRoom.value.name as string,
				validation: { required: true, allow_empty_number: false, allow_empty_object: false, allow_empty_text: false },
			},
			topic: {
				value: editRoom.value.topic as string,
			},
		});
		if (!props.secured) {
			setData({
				type: {
					value: '',
				},
			});
		}
	});

	//#endregion

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 0 || (returnValue === 1 && (await submitRoom()))) {
			emit('close');
		}
	}

	async function submitRoom(): Promise<Boolean> {
		// Normal room
		let room = { ...editRoom.value } as TSecuredRoom;
		if (!props.secured) {
			if (isNewRoom.value) {
				let newRoomOptions = {
					name: room.name,
					topic: room.topic,
					visibility: 'public',
					creation_content: {
						type: room.topic === '' ? undefined : room.topic,
					},
				};
				await pubhubs.createRoom(newRoomOptions);
			} else {
				await pubhubs.renameRoom(props.room.room_id, editRoom.value.name!);

				// update topic
				await pubhubs.setTopic(props.room.room_id as string, editRoom.value.topic!);
			}
			editRoom.value = { ...emptyNewRoom };
		}
		// Secured room
		else {
			let room = { ...editRoom.value } as TSecuredRoom;
			// Transform room for API
			// room.room_name = room.name;
			// delete room.name;
			room.type = RoomType.PH_MESSAGES_RESTRICTED;
			let accepted = {} as SecuredRoomAttributes;
			// @ts-ignore
			room.accepted.forEach((item: any) => {
				accepted[item.yivi] = {
					accepted_values: trimSplit(item.values),
					profile: item.profile,
				};
			});
			room.accepted = accepted;
			if (isNewRoom.value) {
				try {
					await rooms.addSecuredRoom(room);
					editRoom.value = { ...emptyNewRoom };
				} catch (error) {
					errorMessage.value = t((error as Error).message);
					return false;
				}
			} else {
				// check for each item in previousAccepted whether it still exists in room.accepted
				if (!AllAttributeValuesPresent(previousAccepted, room.accepted)) {
					errorMessage.value = t('errors.do_not_remove_attributes');
					return false;
				} else {
					try {
						await rooms.changeSecuredRoom(room);
						editRoom.value = { ...emptyNewRoom };
					} catch (error) {
						errorMessage.value = t((error as Error).message);
						return false;
					}
				}
			}
		}
		return true;
	}

	/**
	 * When changing the required attributes of a secured room, users without these attributes are not removed. They can still enter.
	 * For the moment this is solved by not allowing the values to change. This function checks if all the previous attributevalues
	 * are strill present after edit
	 */
	function AllAttributeValuesPresent(previousAccepted: SecuredRoomAttributes | [], accepted: SecuredRoomAttributes | []): boolean {
		// previous there were no values
		if (Array.isArray(previousAccepted)) {
			return true;
		}

		// previous has values, but new has not
		if (Array.isArray(accepted)) {
			return false;
		}

		// For each key check if any value has been removed
		for (const key in previousAccepted) {
			if (!accepted[key]) {
				// key not present anymore
				return false;
			}
			for (const value of previousAccepted[key].accepted_values) {
				if (!accepted[key].accepted_values.includes(value)) {
					// a value has been removed
					return false;
				}
			}
		}

		// no values have been removed
		return true;
	}
</script>
