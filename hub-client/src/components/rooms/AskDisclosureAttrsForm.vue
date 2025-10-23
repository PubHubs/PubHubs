<template>
	<Dialog v-if="ask" :title="$t('admin.ask_disclosure_title')" :buttons="buttonsSubmitCancel" @close="close($event)">
		<form @submit.prevent>
			<FormLine>
				<Label>{{ $t('admin.ask_disclosure_user_title') }}</Label>
				<span v-if="ask.user.userId" class="cursor-pointer" @click="onChooseUser">
					<span>{{ ask.user.userId }}</span>
					"<span v-if="ask.user.displayName" :title="ask.user.displayName">{{ ask.user.displayName.substring(0, 20) + (ask.user.displayName.length > 20 ? '...' : '') }}</span
					>"
					<Icon type="edit" class="float-right" />
				</span>
				<Icon v-else type="plus" class="float-right cursor-pointer" @click="onChooseUser" />
			</FormLine>
			<FormLine class="mb-2">
				<Label>{{ $t('admin.ask_disclosure_message_title') }}</Label>
				<TextInput :placeholder="$t('admin.ask_disclosure_message_placeholder')" v-model="ask.message" class="w-5/6" />
			</FormLine>
			<FormLine>
				<Label>{{ $t('admin.secured_yivi_attributes') }}</Label>
				<FormObjectInput :template="securedRoomTemplate" v-model="ask.attributes" />
			</FormLine>
			<FormLine>
				<Label>{{ $t('admin.ask_disclosure_where_room_title') }}</Label>
				<TextInput :placeholder="$t('admin.ask_disclosure_where_room_placeholder')" v-model="ask.where_room" class="flex" />
			</FormLine>
			<FormLine>
				<Label>{{ $t('admin.ask_disclosure_where_title') }}</Label>
				<span v-if="ask.where_room">{{ $t('admin.ask_disclosure_where_public') }}</span>
				<span v-else>{{ $t('admin.ask_disclosure_where_private') }}</span>
			</FormLine>
		</form>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import FormLine from '@hub-client/components/forms/FormLine.vue';
	import FormObjectInput from '@hub-client/components/forms/FormObjectInput.vue';
	import Label from '@hub-client/components/forms/Label.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { FormObjectInputTemplate } from '@hub-client/composables/useFormInputEvents';

	// Models
	import { AskDisclosure } from '@hub-client/models/components/signedMessages';

	// Stores
	import { DialogButtonAction, buttonsSubmitCancel } from '@hub-client/stores/dialog';
	import { useYivi } from '@hub-client/stores/yivi';

	const { t } = useI18n();
	const yivi = useYivi();
	const emit = defineEmits(['submit', 'chooseUser', 'close']);
	const ask = ref<AskDisclosure>();

	const props = defineProps<{
		askDisclosure: AskDisclosure;
	}>();

	const securedRoomTemplate = ref([
		{
			key: 'yivi',
			label: t('admin.secured_attribute'),
			type: 'select',
			options: [],
			default: '',
		},
		{
			key: 'values',
			label: t('admin.secured_values'),
			type: 'textarea',
			default: '',
		},
	] as Array<FormObjectInputTemplate>);

	watch(
		() => ask.value,
		async (result) => {
			console.debug(`new: u=${result?.user?.userId}, m=${result?.message}, a=[${result?.attributes?.map((a: any) => a.yivi)}], r=${result?.where_room}`);
		},
		{ deep: true },
	);

	onBeforeMount(async () => {
		// The yivi function has changed, check if it still works as expected if you want to start using this vue component
		securedRoomTemplate.value[0].options = yivi.getAttributes(t);
		ask.value = props.askDisclosure;
	});

	function onChooseUser() {
		const result = ask.value;
		console.debug(`AskDisclosureAttrsForm:onChooseUser: u=${result?.user?.userId}, m=${result?.message}, a=[${result?.attributes?.map((a: any) => a.yivi)}]`);
		emit('chooseUser', result!);
	}

	async function close(returnValue: DialogButtonAction) {
		const result = ask.value;
		console.debug(`AskDisclosureAttrsForm:close(${returnValue}): u=${result?.user?.userId}, m=${result?.message}, a=[${result?.attributes?.map((a: any) => a.yivi)}]`);
		if (returnValue === 1) {
			emit('submit', result!);
		}
		emit('close');
	}
</script>
