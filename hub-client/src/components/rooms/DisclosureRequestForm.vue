<template>
	<Dialog
		:title="title"
		:width="isMobile ? 'px-400 w-full' : 'w-[600px] px-400'"
		@close="close()"
	>
		<ValidatedForm
			v-slot="{ isValidated }"
			class="flex flex-col p-200"
			:class="isMobile ? 'w-full' : 'w-[450px]'"
			@submit.prevent
		>
			<!-- The goal comes first: it decides what the rest of the form is for -->
			<DropDown
				v-model="form.purpose"
				:transformer="dropDownData.transformPurpose"
				:options="purposeOptions"
				:filtered="false"
				:help="purposeHelp"
				:validation="{ required: true }"
				>{{ $t('admin.ask_disclosure_purpose_title') }}</DropDown
			>
			<DropDown
				v-model="form.user"
				:transformer="dropDownData.transformUser"
				:options="userOptions"
				:filtered="true"
				:validation="{ required: true }"
				>{{ $t('admin.ask_disclosure_user_title') }}</DropDown
			>
			<DropDown
				v-model="form.attributes"
				:transformer="dropDownData.transformYiviAttribute"
				:options="yiviAttributes"
				:multiple="true"
				:filtered="true"
				:validation="{ required: true }"
				>{{ $t('admin.secured_yivi_attributes') }}</DropDown
			>
			<DropDown
				v-model="form.where_room"
				:transformer="dropDownData.transformRoom"
				:options="applicableRoomOptions"
				:filtered="true"
				:validation="{ required: true }"
				>{{ $t('rooms.room') }}</DropDown
			>

			<TextArea
				v-model="form.message"
				:placeholder="$t('admin.ask_disclosure_message_placeholder')"
				:validation="{ required: true, maxLength: 100 }"
				@keydown.esc.stop
				>{{ $t('admin.ask_disclosure_message_title') }}</TextArea
			>

			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
					>{{ t('dialog.cancel') }}</Button
				>
				<Button
					type="submit"
					:disabled="!isValidated"
					@click.stop.prevent="onSubmit()"
					>{{ t('dialog.submit') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import DropDown from '@hub-client/components/forms/elements/DropDown.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { useDropDownData } from '@hub-client/composables/DropDownData.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type AskDisclosureMessage, DisclosurePurpose } from '@hub-client/models/components/signedMessages';
	import { type TUserAccount, UserPowerLevel } from '@hub-client/models/users/TUser';
	import { type Attribute } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { type TPublicRoom } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = defineProps<{
		user: TUserAccount;
	}>();

	const emit = defineEmits(['close']);

	const pubhubsStore = usePubhubsStore();
	const dropDownData = useDropDownData();
	const roles = useRoles();
	const logger = createLogger('disclosure-request-form');

	const requiredPowerLevel: Record<DisclosurePurpose, number> = {
		[DisclosurePurpose.Steward]: UserPowerLevel.Steward,
		[DisclosurePurpose.Expert]: UserPowerLevel.Steward,
		[DisclosurePurpose.Information]: UserPowerLevel.User,
	};

	const { t } = useI18n();
	const publicRooms = ref<TPublicRoom[]>([]);
	const userOptions = ref<TUserAccount[]>([]);
	// Hub admins can invite for rooms they aren't in, where the selected user's membership isn't synced, so they ask the server
	const serverJoinedRoomIds = ref<Set<string> | undefined>();
	const purposeOptions = dropDownData.purposeOptions();
	const yiviAttributes = dropDownData.yiviAttributes();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const form = ref({
		user: { name: '' } as { name: string; displayname?: string },
		message: '',
		attributes: [yiviAttributes[0]], // e-mail
		where_room: { room_id: '', name: '' },
		purpose: purposeOptions[0],
	});

	const purposeTexts: Record<DisclosurePurpose, { title: string; help: string }> = {
		[DisclosurePurpose.Steward]: { title: 'admin.ask_disclosure_title_steward', help: 'admin.ask_disclosure_purpose_steward_help' },
		[DisclosurePurpose.Expert]: { title: 'admin.ask_disclosure_title_expert', help: 'admin.ask_disclosure_purpose_expert_help' },
		[DisclosurePurpose.Information]: { title: 'admin.ask_disclosure_title_information', help: 'admin.ask_disclosure_purpose_information_help' },
	};

	const title = computed(() => t(purposeTexts[form.value.purpose.value].title));
	const purposeHelp = computed(() => t(purposeTexts[form.value.purpose.value].help));

	const roomOptions = computed(() => {
		if (!form.value.user.name) return publicRooms.value;
		const joinedRoomIds = serverJoinedRoomIds.value;
		if (joinedRoomIds) return publicRooms.value.filter((room) => joinedRoomIds.has(room.room_id));
		return dropDownData.roomsJoinedBy(publicRooms.value, form.value.user.name);
	});

	const applicableRoomOptions = computed(() => {
		if (roles.userIsHubAdmin()) return roomOptions.value;
		const required = requiredPowerLevel[form.value.purpose.value];
		return roomOptions.value.filter((room) => roles.userPowerLevel(room.room_id) >= required);
	});

	onBeforeMount(async () => {
		publicRooms.value = await dropDownData.publicRoomList();
		userOptions.value = await dropDownData.userListWithoutMe();

		form.value.user = {
			name: props.user.name,
			displayname: props.user.displayname,
		} as TUserAccount;
	});

	watch(
		() => form.value.user.name,
		async (userId) => {
			serverJoinedRoomIds.value = undefined;
			if (!userId || !roles.userIsHubAdmin()) return;
			try {
				const joinedRoomIds = await dropDownData.roomIdsJoinedBy(userId);
				// The selection may have moved to another user while waiting
				if (form.value.user.name === userId) serverJoinedRoomIds.value = joinedRoomIds;
			} catch (error) {
				// Keeps offering the rooms the local state knows about
				logger.error(`Failed to fetch the rooms ${userId} has joined:`, error);
			}
		},
	);

	watch(applicableRoomOptions, (rooms) => {
		if (form.value.where_room.room_id && !rooms.some((room) => room.room_id === form.value.where_room.room_id)) {
			form.value.where_room = { room_id: '', name: '' };
		}
	});

	async function close() {
		emit('close');
	}

	async function onSubmit() {
		const privateRoom = await pubhubsStore.createPrivateRoomWith([form.value.user.name]);
		if (!privateRoom) return;
		const roomId = privateRoom.room_id;

		const result: AskDisclosureMessage = {
			userId: form.value.user?.name,
			replyToRoomId: form.value.where_room.room_id,
			message: form.value.message,
			attributes: form.value.attributes.map((item: Attribute) => item.attribute),
			purpose: form.value.purpose.value,
		};
		// Message is duplicated in body and in 'result' object.
		await pubhubsStore.addAskDisclosureMessage(roomId, result.message, result);
		close();
	}
</script>
