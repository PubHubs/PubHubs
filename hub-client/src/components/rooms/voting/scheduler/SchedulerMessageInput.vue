<template>
	<div class="rounded-md">
		<div class="mb-2 flex border-b p-2">
			<Icon type="scheduler" size="base" class="mx-2 mt-1 flex-none"></Icon>
			<H2 class="flex-grow">{{ $t('message.scheduler') }}</H2>
			<div class="mt-1 flex flex-none">
				<!-- <Icon type="cog" size="sm" :as-button="true" @click="settingsMenu = !settingsMenu" class="ml-auto"></Icon> -->
				<Icon type="closingCross" size="sm" :asButton="true" @click="emit('closeScheduler')" class="ml-2"></Icon>
			</div>
		</div>
		<div class="flex items-center p-2">
			<div class="ml-1 flex w-full flex-col justify-between">
				<div class="flex w-full flex-row">
					<input
						v-model="scheduler.title"
						type="text"
						class="mb-1 w-full rounded-md bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
						:placeholder="$t('message.voting.enter_title')"
						maxlength="100"
						@input="updateScheduler"
					/>
				</div>
				<div class="relative flex w-full">
					<input
						v-model="scheduler.location"
						type="text"
						class="mb-2 w-full rounded-md bg-background pl-7 text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
						:placeholder="$t('message.voting.enter_location')"
					/>
					<Icon type="map_pin" size="sm" class="absolute left-0 top-2 ml-2"></Icon>
				</div>
				<div class="-mb-1 flex w-full flex-row justify-stretch">
					<div class="scrollbar-emojipicker mr-2 w-9/12" id="optionsContainer">
						<div v-for="option in sortedOptions" :key="option.id">
							<SchedulerOptionInput :key="option.id" :option="option" @removeOption="removeOption(option.id)" @updateOption="updateDateOption(option.id, $event)" />
						</div>
						<div v-if="scheduler.options.length < 2" class="mb-1 h-[42px] w-full rounded-lg border bg-background"></div>
					</div>
					<div class="bg-hub-background mb-1 max-h-full w-3/12 rounded-lg border">
						<div v-if="settingsMenu">
							<div class="ml-3 mt-3">
								<Checkbox :label="$t('message.voting.show_votes_before_voting')" @input="updateScheduler" v-model="scheduler.showVotesBeforeVoting"></Checkbox>
							</div>
						</div>
						<textarea
							v-else
							v-model="scheduler.description"
							class="scrollbar-emojipicker h-full w-full resize-none rounded-lg bg-background text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
							maxlength="500"
							:placeholder="$t('message.voting.enter_description')"
							@input="updateScheduler"
						></textarea>
					</div>
				</div>
			</div>
		</div>
		<VotingWidgetSubmitButton :disabled="!scheduler.canSend()" :isEdit="isEdit" @send="emit('sendScheduler')" @edit="emit('editScheduler')"></VotingWidgetSubmitButton>
	</div>
</template>

<script setup lang="ts">
	import { computed, nextTick, ref, watch } from 'vue';
	import Checkbox from '@/components/forms/Checkbox.vue';
	import Icon from '@/components/elements/Icon.vue';
	import SchedulerOptionInput from '@/components/rooms/voting/scheduler/SchedulerOptionInput.vue';
	import { Scheduler, SchedulerOption, SchedulerOptionStatus } from '@/model/events/voting/VotingTypes';

	const props = defineProps({
		schedulerObject: {
			type: [Scheduler, null],
			required: true,
		},
		isEdit: {
			type: Boolean,
			required: true,
		},
	});

	const emit = defineEmits(['createScheduler', 'sendScheduler', 'editScheduler', 'closeScheduler']);
	const scheduler = ref(props.schedulerObject ? props.schedulerObject : new Scheduler());
	const settingsMenu = ref(false);
	const selectingDateOption = ref(-1);
	const date = ref();

	watch(
		() => props.schedulerObject,
		(newScheduler) => {
			if (newScheduler) {
				scheduler.value = newScheduler;
			} else {
				scheduler.value = new Scheduler();
			}
		},
	);

	const sortedOptions = computed(() => {
		const clonedOptions = JSON.parse(JSON.stringify(scheduler.value.options)) as SchedulerOption[];
		clonedOptions.sort((a, b) => {
			let dateA, dateB;
			if (typeof a.date === 'string') {
				dateA = new Date(a.date);
			} else {
				dateA = new Date(a.date[0]);
			}
			if (typeof b.date === 'string') {
				dateB = new Date(b.date);
			} else {
				dateB = new Date(b.date[0]);
			}
			return dateA.getTime() - dateB.getTime();
		});
		return clonedOptions;
	});

	const updateScheduler = () => {
		emit('createScheduler', scheduler.value, scheduler.value.canSend());
	};

	function updateDateOption(optionId: Number, date: Date[]) {
		const option = scheduler.value.options.find((option) => option.id === optionId);
		if (option) {
			option.date = date;
			option.status = SchedulerOptionStatus.FILLED;
		}
		updateScheduler();
		scheduler.value.addNewOptionsIfAllFilled();
	}

	const updateOptions = () => {
		const option = scheduler.value.options.find((option) => option.id === selectingDateOption.value);
		if (option) {
			option.date = date.value;
			date.value = {};
			option.status = SchedulerOptionStatus.FILLED;
			selectingDateOption.value = -1;
		}

		updateScheduler();
		scheduler.value.addNewOptionsIfAllFilled();

		//scroll to the bottom of the options container
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
		scheduler.value.removeOption(id);
		updateOptions();
	};

	// const fillingOption = (id: number) => {
	// 	console.log('fillingOption', id);
	// 	scheduler.value.options.forEach((option) => {
	// 		if (option.id === id) {
	// 			option.status = SchedulerOptionStatus.FILLING;
	// 			selectingDateOption.value = id;
	// 		} else if (option.status === SchedulerOptionStatus.FILLING) {
	// 			option.status = option.date.length > 0 ? SchedulerOptionStatus.FILLED : SchedulerOptionStatus.EMPTY;
	// 		}
	// 	});
	// };
</script>
