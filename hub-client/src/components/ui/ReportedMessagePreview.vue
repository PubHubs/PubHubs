<template>
	<div
		v-if="isLoading"
		class="bg-surface-low rounded-lg p-3"
	>
		<p class="text-on-surface-dim text-sm italic">{{ t('state.loading') }}</p>
	</div>
	<div
		v-else-if="eventData"
		class="flex flex-col gap-2"
	>
		<div class="bg-surface-low rounded-lg p-3">
			<div class="mb-2 flex items-center gap-2">
				<Avatar
					class="h-8 w-8"
					:avatar-url="userStore.userAvatar(eventSender)"
					:user-id="eventSender"
				/>
				<div class="flex flex-col">
					<span class="text-on-surface text-sm font-medium">{{ userStore.userDisplayName(eventSender) || eventSender }}</span>
					<span
						v-if="eventTimestamp"
						class="text-on-surface-dim text-xs"
						>{{ formattedTime }}</span
					>
				</div>
			</div>
			<div class="text-on-surface pl-10">
				<!-- Image message -->
				<template v-if="messageType === 'm.image'">
					<img
						v-if="authMediaUrl?.url"
						:alt="messageBody"
						:src="authMediaUrl.url"
						class="max-h-48 max-w-full rounded-md object-contain"
					/>
					<p
						v-if="messageBody && messageBody !== messageFilename"
						class="mt-2 text-sm wrap-break-word whitespace-pre-wrap"
					>
						{{ messageBody }}
					</p>
				</template>

				<!-- File message -->
				<template v-else-if="messageType === 'm.file'">
					<div
						v-if="authMediaUrl?.url"
						class="bg-surface flex items-center gap-2 rounded-md p-2"
					>
						<Icon
							type="file"
							size="md"
						/>
						<a
							class="text-blue truncate text-sm"
							target="_blank"
							:href="authMediaUrl.url"
							:download="messageFilename"
						>
							{{ messageFilename }}
						</a>
					</div>
					<p
						v-if="messageBody && messageBody !== messageFilename"
						class="mt-2 text-sm wrap-break-word whitespace-pre-wrap"
					>
						{{ messageBody }}
					</p>
				</template>

				<!-- Text message -->
				<p
					v-else-if="messageBody"
					class="text-sm wrap-break-word whitespace-pre-wrap"
				>
					{{ messageBody }}
				</p>

				<!-- Unknown content -->
				<p
					v-else
					class="text-on-surface-dim text-sm italic"
				>
					{{ t('admin.message_content_unavailable') }}
				</p>
			</div>
		</div>
	</div>
	<div
		v-else
		class="bg-surface-low rounded-lg p-3"
	>
		<p class="text-on-surface-dim text-sm italic">{{ t('admin.message_not_found') }}</p>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeUnmount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps<{
		eventId: string;
		roomId: string;
	}>();

	const logger = createLogger('ReportedMessagePreview');
	const { t } = useI18n();
	const matrixFiles = useMatrixFiles();
	const pubhubs = usePubhubsStore();
	const userStore = useUser();

	const authMediaUrl = ref<BlobManager>();
	const eventData = ref<Record<string, unknown> | null>(null);
	const isLoading = ref(false);
	let currentFetchId = 0; // Track current fetch to ignore stale responses

	const eventContent = computed(() => eventData.value?.content as Record<string, unknown> | undefined);
	const eventSender = computed(() => (eventData.value?.sender as string) || '');
	const eventTimestamp = computed(() => eventData.value?.origin_server_ts as number | undefined);
	const messageBody = computed(() => (eventContent.value?.body as string) || '');
	const messageFilename = computed(() => (eventContent.value?.filename as string) || messageBody.value);
	const messageType = computed(() => eventContent.value?.msgtype as string);

	const formattedTime = computed(() => {
		if (!eventTimestamp.value) return '';
		return new Date(eventTimestamp.value).toLocaleString();
	});

	const cleanupMediaUrl = () => {
		authMediaUrl.value?.revoke();
		authMediaUrl.value = undefined;
	};

	const fetchEvent = async () => {
		const fetchId = ++currentFetchId;

		if (!props.roomId || !props.eventId) {
			eventData.value = null;
			cleanupMediaUrl();
			return;
		}

		isLoading.value = true;
		try {
			const data = await pubhubs.getEvent(props.roomId, props.eventId);

			// Ignore stale response if a newer fetch has started
			if (fetchId !== currentFetchId) return;

			eventData.value = data;

			// Clean up previous media URL before potentially setting a new one
			cleanupMediaUrl();

			// Fetch authorized media URL for images/files
			const content = data?.content as Record<string, unknown> | undefined;
			const url = content?.url as string | undefined;
			if (url) {
				const authorizedUrl = await matrixFiles.getAuthorizedMediaUrl(url);

				// Check again for stale response after second async call
				if (fetchId !== currentFetchId) return;

				authMediaUrl.value = new BlobManager(authorizedUrl);
			}
		} catch (error) {
			// Ignore errors from stale requests
			if (fetchId !== currentFetchId) return;

			logger.error('Failed to fetch event:', error);
			eventData.value = null;
			cleanupMediaUrl();
		} finally {
			if (fetchId === currentFetchId) {
				isLoading.value = false;
			}
		}
	};

	watch([() => props.roomId, () => props.eventId], () => fetchEvent(), { immediate: true });

	onBeforeUnmount(() => {
		authMediaUrl.value?.revoke();
	});
</script>
