<template>
	<Dialog
		v-if="ask"
		:title="$t('admin.ask_disclosure_title')"
		:buttons="buttonsSubmitCancel"
		:width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'"
		@close="close($event)"
		@click="
			selectUser = false;
			dropdown = null;
		"
	>
		<form @submit.prevent class="flex flex-col" :class="isMobile ? 'w-full' : 'w-[450px]'">
			<div
				class="mb-2 flex w-full flex-col gap-x-2 gap-y-1"
				@click.stop="
					selectUser = true;
					dropdown = null;
				"
			>
				<Label>{{ $t('admin.ask_disclosure_user_title') }}</Label>

				<span class="bg-background flex cursor-pointer justify-between gap-x-2 rounded-xl border p-1">
					<div class="flex flex-row items-center gap-x-2">
						<Avatar :avatar-url="userStore.userAvatar(ask.user.userId)" :user-id="ask.user.userId"></Avatar>
						<span v-if="ask.user.displayName" :title="ask.user.displayName">{{ ask.user.displayName }}</span>
					</div>
					<div class="flex items-center justify-center"><Icon type="pencil-simple" class="float-right" /></div>
				</span>
			</div>
			<ChooseFromUsersList v-if="selectUser" :header="$t('admin.ask_disclosure_choose_user')" @chosen-user="onChosenUser" @click.stop @keydown.esc.stop="selectUser = false" />

			<div class="mb-2 flex w-full flex-col gap-x-2 gap-y-1">
				<Label>{{ $t('admin.secured_yivi_attributes') }}</Label>
				<div class="flex flex-col">
					<div>
						<AutoComplete
							v-model="attribute"
							:options="yiviAttributes"
							:dropdown="dropdown"
							class="~text-label-min/label-maxflex-1 bg-background rounded-2xl"
							@keydown.enter.prevent="addAttribute"
							@click.stop="
								addAttribute();
								dropdown = 'others.select_value';
								selectUser = false;
							"
						/>
					</div>
					<!-- Tags display -->
					<div v-if="ask.attributes.length > 0" class="mt-2 flex flex-wrap gap-2">
						<span v-for="(attribute, index) in ask.attributes" :key="index" class="bg-background inline-flex items-center gap-1 rounded-xl border px-3 py-1">
							{{ attribute }}
							<Icon type="x" class="hover:text-error cursor-pointer" @click="removeAttribute(index)" />
						</span>
					</div>
				</div>
			</div>
			<div class="mb-2 flex w-full flex-col gap-x-2 gap-y-1">
				<Label>{{ $t('rooms.room') }}</Label>
				<AutoComplete
					v-model="ask.where_room"
					default="admin.private_room"
					:options="roomOptions"
					:dropdown="dropdown"
					@click.stop="
						dropdown = 'admin.private_room';
						selectUser = false;
					"
					class="~text-label-min/label-max bg-background flex-1 rounded-2xl"
				/>
			</div>
			<div class="mb-2 flex w-full flex-col gap-x-2 gap-y-1">
				<Label>{{ $t('admin.ask_disclosure_message_title') }}</Label>
				<TextArea :placeholder="'Add a message to your disclosure request'" :max-length="100" v-model="ask.message" class="bg-background flex min-h-20" @keydown.esc.stop />
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
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AutoComplete from '@hub-client/components/forms/AutoComplete.vue';
	import Label from '@hub-client/components/forms/Label.vue';
	import TextArea from '@hub-client/components/forms/TextArea.vue';
	import ChooseFromUsersList from '@hub-client/components/rooms/ChooseFromUsersList.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { useValidation } from '@hub-client/composables/useValidation';

	// Models
	import { AskDisclosure, AskDisclosureMessage } from '@hub-client/models/components/signedMessages';
	import { TUserAccount } from '@hub-client/models/users/TUser';
	import { ValidationMessage } from '@hub-client/models/validation/TValidate';
	import { Attribute } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { DialogButtonAction, buttonsSubmitCancel } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { User, useUser } from '@hub-client/stores/user';
	import { useYivi } from '@hub-client/stores/yivi';

	const yiviStore = useYivi();
	const userStore = useUser();
	const roomsStore = useRooms();
	const pubhubsStore = usePubhubsStore();

	const { t } = useI18n();
	const emit = defineEmits(['close']);
	const attribute = ref<string>('');
	const selectUser = ref<boolean>(false);
	const dropdown = ref<string | null>('notNull');
	const yiviAttributes = yiviStore.getAttributes(t).map((item) => item.label);
	const settings = useSettings();

	// Validation
	const validationComposable = useValidation();
	const formErrors = ref<Record<string, ValidationMessage> | null>(null);
	const isMobile = computed(() => settings.isMobileState);

	const ask = ref<AskDisclosure>({
		user: { userId: '' },
		message: '',
		attributes: [t('attribute.pbdf.sidn-pbdf.email.email')],
		where_room: '',
	});

	const roomOptions = computed(() => {
		return roomsStore.publicRooms.map((room) => ({
			value: room.room_id,
			label: room.name || room.room_id,
		}));
	});

	function validateRoomForm() {
		const values = {
			attributes: ask.value?.attributes,
		};

		formErrors.value = validationComposable.validateBySchema(values, validationComposable.askDisclosureSchema);
	}
	const props = defineProps<{
		user: TUserAccount;
	}>();

	function addAttribute() {
		if (attribute.value && ask.value && !ask.value.attributes.includes(attribute.value)) {
			if (yiviStore.getAttributes(t).find((attr: Attribute) => attr.label === attribute.value.trim())) {
				ask.value.attributes.push(attribute.value);

				validateRoomForm();
			} else {
				if (!formErrors.value) {
					formErrors.value = {};
				}
				formErrors.value['invalidAttribute'] = {
					translationKey: 'admin.error_invalid_attribute',
					parameters: [attribute.value],
				};
			}
		}
		attribute.value = '';
	}

	function removeAttribute(index: number) {
		if (ask.value) {
			ask.value.attributes.splice(index, 1);
			validateRoomForm();
		}
	}
	onBeforeMount(async () => {
		ask.value.user = {
			userId: props.user.name,
			displayName: props.user.displayname,
		};
		await roomsStore.fetchPublicRooms();
	});

	async function close(returnValue: DialogButtonAction) {
		const result = ask.value;
		selectUser.value = false;
		if (returnValue === 1 && result) {
			result.attributes = result.attributes.map((attribute) => {
				const found = yiviStore.getAttributes(t).find((attr: Attribute) => attr.label === attribute);
				return found ? found.attribute : attribute;
			});
			onSubmit(result);
		}
		emit('close');
	}
	function onChosenUser(other: User) {
		selectUser.value = false;
		ask.value.user = {
			userId: other.userId,
			displayName: other.displayName,
		};
	}
	async function onSubmit(result: AskDisclosure) {
		// Get a private room with recipient
		const privateRoom = await pubhubsStore.createPrivateRoomWith(result.user as User);
		const privateRoomId = privateRoom!.room_id;
		const ask: AskDisclosureMessage = {
			userId: result.user?.userId,
			replyToRoomId: result.where_room || privateRoomId,
			message: result.message,
			attributes: result.attributes,
		};
		// Message is duplicated in body and in 'ask' object.
		await pubhubsStore.addAskDisclosureMessage(privateRoomId, result.message, ask);
	}
</script>
