<template>
	<Dialog :title="title" :buttons="buttonsSubmitCancel" width="w-3/6" @close="close($event)">
		<form @submit.prevent>
			<FormLine>
				<Label>{{ $t('admin.name') }}</Label>
				<TextInput :placeholder="$t('admin.name')" v-model="editRoom.room_name" class="w-5/6" @submit="submitRoom()" @changed="updateData('room_name', $event)"></TextInput>
			</FormLine>
			<div v-if="secured">
				<FormLine class="mb-2">
					<Label>{{ $t('admin.secured_description') }}</Label>
					<TextInput :placeholder="$t('admin.secured_description')" v-model="editRoom.user_txt" class="w-5/6"></TextInput>
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
	import { SecuredRoomAttributes, SecuredRoom, useRooms, useDialog, PublicRoom } from '@/store/store';
	import { useFormState } from '@/composables/useFormState';
	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useYivi } from '@/store/yivi';
	import { useI18n } from 'vue-i18n';
	import { isEmpty, trimSplit } from '@/core/extensions';

	const { t } = useI18n();
	const { setData, updateData } = useFormState();
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const yivi = useYivi();
	const emit = defineEmits(['close']);

	const props = defineProps({
		room: {
			type: Object,
			default: ref({} as unknown as SecuredRoom | PublicRoom),
		},
		secured: {
			type: Boolean,
			default: false,
		},
	});

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

	interface SecuredRoomAttributesObject {
		yivi_attribute: string;
		accepted_values: Array<string>;
		profile: boolean;
	}

	const emptyNewRoom = {
		room_name: '',
		accepted: [] as Array<SecuredRoomAttributesObject>,
		user_txt: '',
	} as SecuredRoom;

	const editRoom = ref({} as PublicRoom | SecuredRoom);

	const securedRoomTemplate = ref([
		{ key: 'yivi', label: t('admin.secured_attribute'), type: 'select', options: [], default: '' },
		{ key: 'values', label: t('admin.secured_values'), type: 'textarea', default: '' },
		{ key: 'profile', label: t('admin.secured_profile'), type: 'checkbox', default: false },
	] as Array<FormObjectInputTemplate>);

	onBeforeMount(async () => {
		await yivi.fetchAttributes();
		securedRoomTemplate.value[0].options = yivi.attributesOptions;

		if (isNewRoom.value) {
			editRoom.value = { ...emptyNewRoom };
		} else {
			editRoom.value = { ...(props.room as SecuredRoom) };
			securedRoomTemplate.value.splice(2, 1); // Profile editing off for existing secured room
			// Transform for form
			let accepted = editRoom.value.accepted as any;
			if (accepted !== undefined) {
				const acceptedKeys = Object.keys(accepted);
				let newAccepted = [] as any;
				acceptedKeys.forEach((key) => {
					let values = accepted[key].accepted_values;
					if (typeof values == 'object') {
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

		setData({
			room_name: {
				value: '',
				validation: { required: true },
			},
		});
	});

	async function close(returnValue: DialogButtonAction) {
		if (returnValue == 1) {
			await submitRoom();
		}
		emit('close');
	}

	async function submitRoom() {
		let room = { ...editRoom.value } as SecuredRoom;

		// Normal room
		if (!props.secured) {
			// Allways new
			await pubhubs.createRoom({
				name: room.room_name,
				visibility: 'public',
			});
			editRoom.value = { ...emptyNewRoom };
		} else {
			// Secured room
			// Transform room for API
			room.type = 'ph.messages.restricted';
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
					const dialog = useDialog();
					dialog.confirm('ERROR', error as string);
				}
			} else {
				try {
					await rooms.changeSecuredRoom(room);
					editRoom.value = { ...emptyNewRoom };
				} catch (error) {
					const dialog = useDialog();
					dialog.confirm('ERROR', error as string);
				}
			}
		}
	}
</script>
