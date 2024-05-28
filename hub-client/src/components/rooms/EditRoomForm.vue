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
					<FormObjectInput v-if="editRoom.accepted" :template="securedRoomTemplate" v-model="editRoom.accepted"></FormObjectInput>
				</FormLine>
			</div>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
	import { onBeforeMount, ref, computed } from 'vue';
	import { buttonsSubmitCancel, DialogButtonAction } from '@/store/dialog';
	import { SecuredRoomAttributes, TSecuredRoom, useRooms, useDialog, TPublicRoom, RoomType } from '@/store/store';
	import { useFormState } from '@/composables/useFormState';
	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useYivi } from '@/store/yivi';
	import { useI18n } from 'vue-i18n';
	import { isEmpty, trimSplit } from '@/core/extensions';

	const { t } = useI18n();
	const { setSubmitButton, setData, updateData } = useFormState();
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const dialog = useDialog();
	const yivi = useYivi();
	const emit = defineEmits(['close']);

	const props = defineProps({
		room: {
			type: Object,
			default: ref({} as unknown as TSecuredRoom | TPublicRoom),
		},
		secured: {
			type: Boolean,
			default: false,
		},
	});

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

	const editRoom = ref({} as TPublicRoom | TSecuredRoom);

	const securedRoomTemplate = ref([
		{ key: 'yivi', label: t('admin.secured_attribute'), type: 'autocomplete', options: [], default: '' },
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
			editRoom.value = { ...emptyNewRoom } as TPublicRoom | TSecuredRoom;
		} else {
			// Edit room
			editRoom.value = { ...(props.room as TPublicRoom | TSecuredRoom) };
			editRoom.value.topic = rooms.getRoomTopic(props.room.room_id);

			// Transform for form
			if (props.secured) {
				// Remove 'profile' for existing secured room (cant be edited after creation)
				securedRoomTemplate.value.splice(2, 1);
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

		setSubmitButton(dialog.properties.buttons[0]);

		setData({
			name: {
				value: editRoom.value.name as string,
				validation: { required: true },
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
		if (returnValue === 1) {
			await submitRoom();
		}
		emit('close');
	}

	async function submitRoom() {
		let room = { ...editRoom.value } as TSecuredRoom;

		// Normal room
		if (!props.secured) {
			if (isNewRoom.value) {
				let newRoomOptions = {
					name: room.name,
					topic: room.topic,
					visibility: 'public',
					creation_content: {
						type: room.type === '' ? undefined : room.type,
					},
				};
				await pubhubs.createRoom(newRoomOptions);
			} else {
				// update name
				await pubhubs.renameRoom(room.room_id as string, room.name);
				// update topic
				await pubhubs.setTopic(room.room_id as string, room.topic as string);
			}
			editRoom.value = { ...emptyNewRoom };
		}
		// Secured room
		else {
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
					dialog.confirm('ERROR', error as string);
				}
			} else {
				try {
					await rooms.changeSecuredRoom(room);
					editRoom.value = { ...emptyNewRoom };
				} catch (error) {
					dialog.confirm('ERROR', error as string);
				}
			}
		}
	}
</script>
