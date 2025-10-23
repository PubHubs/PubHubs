<template>
	<div class="rounded-md">
		<div class="mb-2 flex border-b p-2">
			<Icon type="poll" size="base" class="mx-2 mt-1 flex-none"></Icon>
			<H2 class="flex-grow">{{ $t('message.poll') }}</H2>
			<div class="mt-1 flex flex-none">
				<!-- <Icon type="cog" size="sm" :as-button="true" @click="settingsMenu = !settingsMenu" class="ml-auto"></Icon> -->
				<Icon type="closingCross" size="sm" :asButton="true" @click="emit('closePoll')" class="ml-2"></Icon>
			</div>
		</div>
		<div class="flex items-center p-2">
			<div class="ml-1 flex w-full flex-col justify-between">
				<div class="flex w-full flex-row">
					<input
						v-model="poll.title"
						type="text"
						class="mb-2 w-full rounded-lg bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
						:placeholder="$t('message.voting.enter_title')"
						maxlength="100"
						@input="updatePoll"
					/>
				</div>
				<div class="-mb-1 flex w-full flex-row">
					<div class="scrollbar-emojipicker mr-2 max-h-[184px] w-2/3 overflow-auto" id="optionsContainer">
						<div v-for="option in poll.options" :key="option.id" class="relative">
							<input
								v-model="option.title"
								type="text"
								class="mb-1 w-full rounded-lg bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
								:placeholder="$t('message.voting.enter_option')"
								maxlength="70"
								@input="updateOptions"
								@blur="cleanupPollOption(option)"
							/>
							<Icon type="closingCross" size="sm" :as-button="true" @click="removeOption(option.id)" v-if="option.title !== ''" class="absolute right-2 top-2"></Icon>
						</div>
						<input
							v-if="poll.options.length < 3"
							class="mb-1 w-full rounded-lg bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
							disabled
						/>
						<Checkbox :label="$t('message.voting.show_votes_before_voting')" v-model="poll.showVotesBeforeVoting" @input="updatePoll"></Checkbox>
					</div>
					<div class="mb-1 max-h-full w-1/3 rounded-lg border bg-background" v-if="settingsMenu">
						<div class="ml-3 mt-3">
							<div>
								<Checkbox :label="$t('message.voting.show_votes_before_voting')" v-model="poll.showVotesBeforeVoting" @input="updatePoll"></Checkbox>
							</div>
						</div>
					</div>
					<textarea
						v-else
						v-model="poll.description"
						class="scrollbar-emojipicker mb-1 max-h-full w-1/3 resize-none rounded-lg bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
						maxlength="500"
						:placeholder="$t('message.voting.enter_description')"
						@input="updatePoll"
					></textarea>
				</div>
			</div>
		</div>
		<VotingWidgetSubmitButton :disabled="!poll.canSend()" :isEdit="isEdit" @send="emit('sendPoll')" @edit="emit('editPoll')"></VotingWidgetSubmitButton>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Checkbox from '@hub-client/components/forms/Checkbox.vue';

	/// Models
	import { Poll, PollOption } from '@hub-client/models/events/voting/VotingTypes';

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
	const settingsMenu = ref(false);

	// Watch for switching between creating and editing a poll
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

		// Scroll to the bottom of the options container
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
