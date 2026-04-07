<template>
	<div class="rounded-md">
		<div class="mb-2 flex border-b p-2">
			<Icon
				class="mx-2 mt-1 flex-none"
				size="base"
				type="chart-bar"
			/>
			<H2 class="grow">
				{{ $t('message.poll') }}
			</H2>
			<div class="mt-1 flex flex-none">
				<!-- <Icon type="sliders-horizontal" size="sm" :as-button="true" @click="settingsMenu = !settingsMenu" class="ml-auto"></Icon> -->
				<IconButton
					class="ml-2"
					size="sm"
					type="x"
					@click="emit('closePoll')"
				/>
			</div>
		</div>
		<div class="flex items-center p-2">
			<div class="ml-1 flex w-full flex-col justify-between">
				<div class="flex w-full flex-row">
					<input
						v-model="poll.title"
						class="bg-background text-on-surface placeholder-on-surface-dim text-label focus:border-on-surface mb-2 w-full rounded-lg p-100 focus:ring-0 focus:outline-0 focus:outline-offset-0"
						maxlength="100"
						:placeholder="$t('message.voting.enter_title')"
						type="text"
						@input="updatePoll"
					/>
				</div>
				<div class="-mb-1 flex w-full flex-row">
					<div
						id="optionsContainer"
						class="scrollbar-emojipicker mr-2 max-h-[184px] w-2/3 overflow-auto"
					>
						<div
							v-for="option in poll.options"
							:key="option.id"
							class="relative"
						>
							<input
								v-model="option.title"
								class="bg-background text-on-surface placeholder-on-surface-dim text-label focus:border-on-surface mb-1 w-full rounded-lg p-100 focus:ring-0 focus:outline-0 focus:outline-offset-0"
								maxlength="70"
								:placeholder="$t('message.voting.enter_option')"
								type="text"
								@blur="cleanupPollOption(option)"
								@input="updateOptions"
							/>
							<Icon
								v-if="option.title !== ''"
								:as-button="true"
								class="absolute top-2 right-2"
								size="sm"
								type="x"
								@click="removeOption(option.id)"
							/>
						</div>
						<input
							v-if="poll.options.length < 3"
							class="bg-background text-on-surface placeholder-on-surface-dim text-label focus:border-on-surface mb-1 w-full rounded-lg p-100 focus:ring-0 focus:outline-0 focus:outline-offset-0"
							disabled
						/>
						<Checkbox
							v-model="poll.showVotesBeforeVoting"
							:label="$t('message.voting.show_votes_before_voting')"
							@input="updatePoll"
						/>
					</div>
					<div
						v-if="settingsMenu"
						class="bg-background mb-1 max-h-full w-1/3 rounded-lg border"
					>
						<div class="mt-3 ml-3">
							<div>
								<Checkbox
									v-model="poll.showVotesBeforeVoting"
									:label="$t('message.voting.show_votes_before_voting')"
									@input="updatePoll"
								/>
							</div>
						</div>
					</div>
					<textarea
						v-else
						v-model="poll.description"
						class="scrollbar-emojipicker bg-background text-on-surface placeholder-on-surface-dim text-label focus:border-on-surface mb-1 max-h-full w-1/3 resize-none rounded-lg p-100 focus:ring-0 focus:outline-0 focus:outline-offset-0"
						maxlength="500"
						:placeholder="$t('message.voting.enter_description')"
						@input="updatePoll"
					/>
				</div>
			</div>
		</div>
		<VotingWidgetSubmitButton
			:disabled="!poll.canSend()"
			:is-edit="isEdit"
			@edit="emit('editPoll')"
			@send="emit('sendPoll')"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { nextTick, ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Checkbox from '@hub-client/components/forms/Checkbox.vue';

	/// Models
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
