<template>
	<div class="border-surface-high bg-background relative flex h-full w-full shrink-0 flex-col border-l md:w-[33%]">
		<div class="bg-surface-low m-3 mb-0 flex items-center gap-2 rounded-md p-2">
			<!-- TODO: add language variable -->
			<p class="~text-label-tiny-min/label-tiny-max truncate text-nowrap">Participants ({{ remoteParticipants.length }})</p>
		</div>

		<div
			v-for="username in remoteParticipants"
			:key="username"
		>
			<ParticipantCard :remote-participant-name="username"></ParticipantCard>
		</div>
	</div>
</template>

<script setup lang="ts">
	import ParticipantCard from './ParticipantCard.vue';

	defineProps<{
		remoteParticipants: string[];
	}>();
</script>
