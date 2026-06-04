<template>
	<div class="rounded-base bg-surface-base overflow-hidden">
		<div class="rounded-t-base bg-accent-blue/10 border-accent-blue flex h-500 items-center justify-between gap-100 border-b px-200">
			<div class="flex min-w-0 items-center gap-100">
				<Icon
					class="text-accent-blue shrink-0"
					size="sm"
					type="chart-bar"
				/>
				<span class="text-accent-blue text-label-small shrink-0">{{ $t('message.poll') }}</span>
			</div>
			<IconButton
				icon="x"
				size="sm"
				@click="emit('closePoll')"
			/>
		</div>
		<div class="border-surface-elevated rounded-base flex flex-col gap-200 border-3 p-200">
			<TextField
				v-model="poll.title"
				:validation="{ required: true, maxLength: 100 }"
				:placeholder="$t('message.voting.enter_title')"
				@input="updatePoll"
				>{{ $t('message.voting.title') }}</TextField
			>
			<div
				id="optionsContainer"
				class="scrollbar-emojipicker flex flex-col gap-200"
			>
				<div
					v-for="option in poll.options"
					:key="option.id"
				>
					<TextField
						v-model="option.title"
						:validation="{ maxLength: 70 }"
						:placeholder="$t('message.voting.enter_option')"
						:right-icon="option.title !== '' ? 'x' : undefined"
						right-icon-class="hover:text-accent-red hover:cursor-pointer"
						@right-icon-click="removeOption(option.id)"
						@blur="cleanupPollOption(option)"
						@input="updateOptions"
						>{{ $t('message.voting.option') }}</TextField
					>
				</div>
				<TextField
					v-model="poll.description"
					type="textarea"
					:validation="{ maxLength: 500 }"
					:placeholder="$t('message.voting.enter_description')"
					@input="updatePoll"
					>{{ $t('message.voting.description') }}</TextField
				>
				<VotingWidgetSubmitButton
					:disabled="!poll.canSend()"
					:is-edit="isEdit"
					@edit="emit('editPoll')"
					@send="emit('sendPoll')"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	import { nextTick, ref, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import VotingWidgetSubmitButton from '@hub-client/components/rooms/voting/VotingWidgetSubmitButton.vue';

	import { Poll, type PollOption } from '@hub-client/models/events/voting/VotingTypes';

	const props = defineProps({
		pollObject: {
			type: [Poll, null],
			required: true,
		},
		isEdit: {
			type: Boolean,
			required: true,
		},
	});

	const emit = defineEmits(['createPoll', 'sendPoll', 'editPoll', 'closePoll']);
	const poll = ref(props.pollObject ? props.pollObject : new Poll());

	watch(
		() => props.pollObject,
		(newPoll) => {
			if (newPoll) {
				poll.value = newPoll;
			} else {
				poll.value = new Poll();
			}
		},
	);

	const updatePoll = () => {
		emit('createPoll', poll.value, poll.value.canSend());
	};

	const updateOptions = () => {
		updatePoll();
		poll.value.addNewOptionsIfAllFilled();

		nextTick(() => {
			const container = document.getElementById('optionsContainer');
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
			const mobileContainer = document.getElementById('mobileOptionsContainer');
			if (mobileContainer) {
				mobileContainer.scrollTop = mobileContainer.scrollHeight;
			}
		});
	};

	const removeOption = (id: number) => {
		poll.value.removeOption(id);
		updateOptions();
	};

	const cleanupPollOption = (option: PollOption) => {
		if (option.title === '') {
			removeOption(option.id);
		}
	};
</script>
