<template>
	<div class="flex flex-col h-screen">
		<div class="h-20 pt-4 px-4 z-10">
			<H1 class="mt-4">{{ $t('admin.title') }}</H1>
			<p class="text-sm">{{ $t('admin.description') }}</p>
		</div>
		<Line class="m-4 mb-4"></Line>
		<div class="px-4">
			<Tabs>
				<TabHeader>
					<TabPill>Secured Rooms</TabPill>
					<TabPill>{{ $t('admin.add_room') }}</TabPill>
				</TabHeader>
				<TabContainer>
					<TabContent>
						<p v-if="!rooms.hasSecuredRooms">{{ $t('admin.no_secured_rooms') }}</p>
						<ul v-else>
							<li v-for="room in rooms.sortedSecuredRooms" :key="room.room_id" class="group hover:bg-green p-1 rounded">
								<Icon type="lock" class="mr-4 float-left text-green group-hover:text-black"></Icon>
								<span :title="room.room_id">
									{{ room.room_name }} <span v-if="room.user_txt !== ''">- {{ room.user_txt }}</span>
								</span>
								<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removeSecuredRoom(room)"></Icon>
							</li>
						</ul>
					</TabContent>

					<TabContent>
						<form @submit.prevent>
							<FormLine>
								<Label>{{ $t('admin.name') }}</Label>
								<TextInput :placeholder="$t('admin.name')" v-model="newRoom.room_name" class="w-5/6" @submit="addNewRoom()" @changed="updateData('room_name', $event)"></TextInput>
							</FormLine>
							<FormLine>
								<Label>{{ $t('admin.secured_room') }}</Label>
								<Checkbox v-model="newRoom.secured"></Checkbox>
							</FormLine>

							<div v-show="newRoom.secured">
								<FormLine class="mb-2">
									<Label>{{ $t('admin.secured_description') }}</Label>
									<TextInput :placeholder="$t('admin.secured_description')" v-model="newRoom.user_txt" class="w-5/6"></TextInput>
								</FormLine>
								<FormLine>
									<Label>{{ $t('admin.secured_yivi_attributes') }}</Label>
									<FormObjectInput :template="securedRoomTemplate" v-model="newRoom.accepted"></FormObjectInput>
								</FormLine>
							</div>

							<FormLine class="mt-2">
								<Button @click.prevent="addNewRoom()" :disabled="!isValidated()">{{ $t('forms.submit') }}</Button>
							</FormLine>
						</form>
						<div v-if="message != ''" class="rounded-lg bg-red p-2 mt-2">{{ message }}</div>
					</TabContent>
				</TabContainer>
			</Tabs>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { SecuredRoomAttributes, SecuredRoom, useRooms, useDialog } from '@/store/store';
	import { useFormState } from '@/composables/useFormState';
	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';
	import { useYivi } from '@/store/yivi';
	import { useI18n } from 'vue-i18n';
	import { trimSplit } from '@/core/extensions';

	const { t } = useI18n();
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const yivi = useYivi();
	const { setData, updateData, isValidated, message, setMessage } = useFormState();

	interface SecuredRoomAttributesObject {
		yivi_attribute: string;
		accepted_values: Array<string>;
		profile: boolean;
	}

	const emptyNewRoom = {
		room_name: '',
		accepted: [] as Array<SecuredRoomAttributesObject>,
		user_txt: '',
		secured: false,
	} as SecuredRoom;

	const newRoom = ref({ ...emptyNewRoom });

	const securedRoomTemplate = ref([
		{ key: 'yivi', label: t('admin.secured_attribute'), type: 'select', options: [], default: '' },
		{ key: 'values', label: t('admin.secured_values'), type: 'textarea', default: '' },
		{ key: 'profile', label: t('admin.secured_profile'), type: 'checkbox', default: false },
	] as Array<FormObjectInputTemplate>);

	onMounted(async () => {
		await rooms.fetchSecuredRooms();
		await yivi.fetchAttributes();
		securedRoomTemplate.value[0].options = yivi.attributesOptions;
		setData({
			room_name: {
				value: '',
				validation: { required: true },
			},
		});
	});

	async function addNewRoom() {
		let room = { ...newRoom.value } as SecuredRoom;

		// Normal room
		if (!room.secured) {
			await pubhubs.createRoom({
				name: room.room_name,
				visibility: 'public',
			});
			newRoom.value = { ...emptyNewRoom };
			setMessage(t('admin.added_room'));

			// Secured room
		} else {
			// Transform room for API
			delete room.secured;
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

			try {
				await rooms.addSecuredRoom(room);
				newRoom.value = { ...emptyNewRoom };
				setMessage(t('admin.added_room'));
			} catch (error) {
				const dialog = useDialog();
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function removeSecuredRoom(room: SecuredRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.secured_remove_sure'))) {
			try {
				await rooms.removeSecuredRoom(room);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}
</script>
