<template>
	<div class="gap-050 flex flex-col wrap-break-word">
		<!-- Deleted Message -->
		<template v-if="deleted">
			<div class="gap-050 flex flex-row items-center">
				<Icon
					class="text-on-surface-dim"
					size="sm"
					type="trash"
				/>
				<p class="text-on-surface-dim overflow-hidden text-ellipsis">
					{{ deletedBySteward ? t('message.delete.message_removed_by_steward') : t('message.delete.message_deleted') }}
				</p>
			</div>
			<!-- Reason shown only to original poster -->
			<p
				v-if="deletedBySteward && redactionReason && (isOriginalPoster || roles.userIsStewardOrHigher(props.event.room_id))"
				class="text-on-surface-dim ml-250 overflow-hidden text-sm text-ellipsis italic"
			>
				{{ t('message.delete.reason') }}: {{ redactionReason }}
			</p>
		</template>

		<!-- Message Body (with or without mentions) -->
		<MessageBodyWithMentions
			v-else
			:body="event.content.body"
			:ph-body="event.content.ph_body"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';

	// Composables
	import { useRoles } from '@hub-client/composables/roles.composable';

	// Models
	import { Redaction } from '@hub-client/models/constants';
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		deleted: boolean;
		event: TMessageEvent;
	}>();

	const { t } = useI18n();
	const userStore = useUser();
	const roles = useRoles();

	const redactedBecause = computed(() => props.event.unsigned?.redacted_because);
	const deletedBySteward = computed(() => {
		if (!redactedBecause.value) return false;
		return redactedBecause.value.sender !== props.event.sender;
	});
	const isOriginalPoster = computed(() => props.event.sender === userStore.userId);
	const redactionReason = computed(() => {
		if (!redactedBecause.value) return undefined;
		const reason = redactedBecause.value.content?.reason as string | undefined;
		if (!reason || reason === Redaction.Deleted || reason === Redaction.DeletedFromThread || reason === Redaction.DeletedFromLibrary) {
			return undefined;
		}
		return reason;
	});
</script>
