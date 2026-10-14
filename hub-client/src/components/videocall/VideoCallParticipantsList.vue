<template>
	<div class="flex h-full flex-col overflow-y-hidden py-200">
		<SidebarHeader :title="t('videocall.participants_count', { count: remoteParticipants.length + (localParticipantName ? 1 : 0) })" />

		<div class="gap-050 flex flex-1 flex-col overflow-y-auto px-200">
			<ParticipantCard
				v-if="localParticipantName"
				:is-self="true"
				:remote-participant-name="localParticipantName"
			/>
			<ParticipantCard
				v-for="username in remoteParticipants"
				:key="username"
				:remote-participant-name="username"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';
	import ParticipantCard from '@hub-client/components/videocall/ParticipantCard.vue';

	// Stores
	import useVideoCall from '@hub-client/stores/videoCall';

	// Props
	defineProps<{
		remoteParticipants: string[];
	}>();

	const { t } = useI18n();
	const videoCall = useVideoCall();

	const localParticipantName = computed(() => videoCall.livekit_room?.localParticipant?.identity);
</script>
