<template>
	<div class="rounded-base">
		<div class="rounded-t-base bg-accent-blue/10 border-accent-blue flex h-500 items-center justify-between gap-100 border-b px-200">
			<div class="flex min-w-0 items-center gap-100">
				<Icon
					class="text-accent-blue shrink-0"
					size="sm"
					type="calendar"
				/>
				<span class="text-accent-blue text-label-small shrink-0">{{ $t('message.scheduler') }}</span>
			</div>
			<IconButton
				icon="x"
				size="sm"
				@click="emit('closeScheduler')"
			/>
		</div>
		<div class="border-surface-elevated rounded-base flex flex-col gap-200 border-3 p-200">
			<TextField
				v-model="scheduler.title"
				:validation="{ required: true, maxLength: 100 }"
				:placeholder="$t('message.voting.enter_title')"
				@input="updateScheduler"
				>{{ $t('message.voting.title') }}</TextField
			>
			<TextField
				v-model="scheduler.location"
				icon="map-pin"
				:placeholder="$t('message.voting.enter_location')"
				>{{ $t('message.voting.location') }}</TextField
			>
			<div
				id="optionsContainer"
				class="scrollbar-emojipicker flex flex-col gap-100"
			>
				<div
					v-for="option in sortedOptions"
					:key="option.id"
				>
					<SchedulerOptionInput
						:key="option.id"
						:option="option"
						@remove-option="removeOption(option.id)"
						@update-option="updateDateOption(option.id, $event)"
					/>
				</div>
			</div>
			<TextField
				v-model="scheduler.description"
				type="textarea"
				:validation="{ maxLength: 500 }"
				:placeholder="$t('message.voting.enter_description')"
				@input="updateScheduler"
				>{{ $t('message.voting.description') }}</TextField
			>
			<VotingWidgetSubmitButton
				:disabled="!scheduler.canSend()"
				:is-edit="isEdit"
				@edit="emit('editScheduler')"
				@send="emit('sendScheduler')"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, nextTick, ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import VotingWidgetSubmitButton from '@hub-client/components/rooms/voting/VotingWidgetSubmitButton.vue';
	import SchedulerOptionInput from '@hub-client/components/rooms/voting/scheduler/SchedulerOptionInput.vue';

	// Models
	import { Scheduler, type SchedulerOption, SchedulerOptionStatus } from '@hub-client/models/events/voting/VotingTypes';

	// Props
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

	function updateDateOption(optionId: number, date: Date[]) {
		const option = scheduler.value.options.find((option) => option.id === optionId);
		if (option) {
			option.date = date;
			option.status = SchedulerOptionStatus.FILLED;
		}
		updateScheduler();
		scheduler.value.addNewOptionsIfAllFilled();
	}

	const updateOptions = () => {
		updateScheduler();
		scheduler.value.addNewOptionsIfAllFilled();

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
</script>
