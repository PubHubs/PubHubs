<template>
	<div class="flex flex-1 flex-col overflow-hidden">
		<SidebarBackButton @click="$emit('back')" />

		<!-- Scrollable content -->
		<div class="flex flex-1 flex-col gap-300 overflow-y-auto px-200 pt-300 pb-400">
			<div class="bg-surface-base rounded-base border-surface-elevated flex items-center gap-150 border-3 p-200">
				<FileIcon
					class="shrink-0"
					:filename="filename"
				/>
				<span class="min-w-0 font-semibold wrap-anywhere">{{ filename }}</span>
			</div>

			<dl class="text-label-small grid grid-cols-[auto_1fr] items-center gap-x-200 gap-y-100">
				<dt class="text-on-surface-dim">{{ t('roomlibrary.info.filetype') }}</dt>
				<dd>{{ fileType }}</dd>
				<dt class="text-on-surface-dim">{{ t('roomlibrary.info.filesize') }}</dt>
				<dd>{{ fileSize }}</dd>
				<dt class="text-on-surface-dim">{{ t('roomlibrary.info.uploaded_by') }}</dt>
				<dd class="min-w-0">
					<AvatarDisplayNameCompact
						v-if="sender"
						:user-display-name="user.userDisplayName(sender)"
						:user-id="sender"
					/>
				</dd>
				<dt class="text-on-surface-dim">{{ t('roomlibrary.info.uploaded_on') }}</dt>
				<dd><EventTimeCompact :timestamp="item.matrixEvent.getTs()" /></dd>
				<template v-if="signatures.length > 0">
					<dt class="text-on-surface-dim self-start">{{ t('roomlibrary.signed') }}</dt>
					<dd class="flex min-w-0 flex-col gap-100">
						<div
							v-for="signature in signatures"
							:key="signature.matrixEvent.getId()"
							class="gap-050 flex min-w-0 flex-col items-start"
							data-testid="library-signature"
						>
							<DisplayNameCompact
								:user-display-name="user.userDisplayName(signature.matrixEvent.getSender() ?? '')"
								:user-id="signature.matrixEvent.getSender()!"
							/>
							<span
								v-for="attribute in attributesOf(signature)"
								:key="attribute.id"
								class="rounded-base bg-surface-elevated flex max-w-full items-center gap-100 px-150 py-100"
							>
								<Icon
									class="text-accent-blue shrink-0"
									size="sm"
									type="seal-check"
								/>
								<span class="wrap-anywhere">{{ attribute.rawvalue }}</span>
							</span>
						</div>
					</dd>
				</template>
			</dl>

			<!-- Actions -->
			<div
				v-if="actions.length"
				class="gap-050 flex flex-col"
			>
				<template
					v-for="(action, index) in actions"
					:key="index"
				>
					<hr
						v-if="action.divider"
						class="border-on-surface-disabled/25 my-050"
					/>
					<button
						v-else
						class="hover:bg-surface-elevated rounded-base outline-accent-blue-interactive flex items-center gap-150 p-150 text-left transition-colors hover:cursor-pointer focus-visible:outline-3"
						:class="action.variant"
						type="button"
						:title="action.title"
						@click="action.onClick?.()"
					>
						<Icon
							v-if="action.icon"
							size="sm"
							:type="action.icon"
						/>
						<span class="text-label-small">{{ action.label }}</span>
					</button>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AvatarDisplayNameCompact from '@hub-client/components/rooms/AvatarDisplayNameCompact.vue';
	import DisplayNameCompact from '@hub-client/components/rooms/DisplayNameCompact.vue';
	import EventTimeCompact from '@hub-client/components/rooms/EventTimeCompact.vue';
	import FileIcon from '@hub-client/components/ui/FileIcon.vue';
	import SidebarBackButton from '@hub-client/components/ui/SidebarBackButton.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import { type SignedMessage, getDisclosedAttributes } from '@hub-client/models/components/signedMessages';
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		item: TimelineEvent;
		signatures: TimelineEvent[];
		actions: MenuItem[];
	}>();

	defineEmits<{
		back: [];
	}>();

	const { t } = useI18n();
	const user = useUser();

	const content = computed(() => props.item.matrixEvent.getContent());
	const filename = computed<string>(() => content.value.filename ?? content.value.body ?? '');
	const sender = computed(() => props.item.matrixEvent.getSender());

	const fileType = computed(() => {
		const dot = filename.value.lastIndexOf('.');
		if (dot > 0) return filename.value.slice(dot + 1).toUpperCase();
		const mimetype: string = content.value.info?.mimetype ?? '';
		return mimetype.replace(/^.+\//, '').toUpperCase() || '-';
	});

	const fileSize = computed(() => {
		const size = content.value.info?.size;
		return typeof size === 'number' ? filters.formatBytes(size, 1) : '-';
	});

	const attributesOf = (signature: TimelineEvent) => {
		const signedMessage = signature.matrixEvent.getContent().signed_message as SignedMessage | undefined;
		return signedMessage ? getDisclosedAttributes(signedMessage) : [];
	};
</script>
