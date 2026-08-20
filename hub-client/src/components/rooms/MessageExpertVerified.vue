<template>
	<div
		v-if="verificationInfo"
		class="bg-surface-base border-surface-elevated rounded-base mt-2 flex w-fit items-center gap-2 gap-x-100 border-3 p-100"
		:class="borderClass"
		:title="tooltipText"
	>
		<div class="relative flex shrink-0 flex-row">
			<Avatar
				:avatar-url="expertAvatarUrl"
				:user-id="expertUserId"
			/>
			<Icon
				class="absolute -right-1 -bottom-1 rounded-full bg-white p-px"
				:class="iconColorClass"
				size="sm"
				:type="iconType"
			/>
		</div>
		<div class="flex min-w-0 flex-col">
			<div class="flex flex-row flex-wrap gap-100">
				<H1 class="truncate">
					{{ statusText }}
				</H1>
				<span
					v-for="(specialization, index) in verificationInfo.specializations"
					:key="index"
					class="text-label-tiny rounded-base bg-surface-elevated py-050 px-150"
				>
					{{ specialization }}
				</span>
			</div>
			<span
				v-if="verificationInfo.verification_note"
				class="text-label-tiny text-on-surface mt-1 line-clamp-2"
			>
				{{ verificationInfo.verification_note }}
			</span>
			<div
				v-if="verificationInfo.sources?.length"
				class="text-label-tiny mt-1"
			>
				<button
					type="button"
					class="text-on-surface-dim gap-050 flex cursor-pointer items-center"
					@click="sourcesExpanded = !sourcesExpanded"
				>
					<Icon
						size="sm"
						:type="sourcesExpanded ? 'caret-down' : 'caret-right'"
					/>
					{{ t('expert.sources_display_label') }} ({{ verificationInfo.sources.length }})
				</button>
				<ul
					v-if="sourcesExpanded"
					class="text-on-surface mt-050 ml-4 list-disc"
				>
					<li
						v-for="(source, index) in verificationInfo.sources"
						:key="index"
						class="truncate"
					>
						<a
							v-if="isUrl(source)"
							:href="source"
							target="_blank"
							rel="noopener noreferrer"
							class="text-accent-primary hover:underline"
							:title="source"
						>
							<span class="text-on-surface-dim">[{{ getUrlDomain(source) }}]</span>
							{{ source }}
						</a>
						<span v-else>{{ source }}</span>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { type TVerificationInfo } from '@hub-client/composables/moderation/expert-verification.composable';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		verificationInfo: TVerificationInfo;
	};

	// Props
	const props = defineProps<Props>();

	const { t } = useI18n();
	const userStore = useUser();

	const expertUserId = computed(() => props.verificationInfo.expert_user_id);

	const expertAvatarUrl = computed(() => userStore.userAvatar(expertUserId.value));

	const expertDisplayName = computed(() => {
		return userStore.userDisplayName(props.verificationInfo.expert_user_id) ?? props.verificationInfo.expert_user_id;
	});

	const verificationType = computed(() => props.verificationInfo.verification_type ?? 'verified');

	const iconType = computed(() => {
		switch (verificationType.value) {
			case 'falsified':
				return 'warning';
			case 'context':
				return 'info';
			default:
				return 'seal-check';
		}
	});

	const iconColorClass = computed(() => {
		switch (verificationType.value) {
			case 'falsified':
				return 'text-accent-error';
			case 'context':
				return 'text-accent-primary';
			default:
				return 'text-accent-success';
		}
	});

	const borderClass = computed(() => {
		switch (verificationType.value) {
			case 'falsified':
				return 'border-accent-error';
			case 'context':
				return 'border-accent-primary';
			default:
				return 'border-accent-success';
		}
	});

	const statusText = computed(() => {
		const typeKey = verificationType.value;
		const expertName = expertDisplayName.value;
		return t(`expert.${typeKey}_by`, { expert: expertName });
	});

	const tooltipText = computed(() => {
		const date = new Date(props.verificationInfo.verified_at).toLocaleString();
		return t('expert.assessed_at', { date });
	});

	const sourcesExpanded = ref(false);

	/**
	 * Validates and parses a URL string.
	 * Returns the parsed URL if valid and safe, null otherwise.
	 * Only allows http and https protocols.
	 */
	const parseUrl = (text: string): URL | null => {
		try {
			const url = new URL(text);
			// Only allow http and https protocols
			if (url.protocol !== 'http:' && url.protocol !== 'https:') {
				return null;
			}
			return url;
		} catch {
			return null;
		}
	};

	const isUrl = (text: string): boolean => {
		return parseUrl(text) !== null;
	};

	/**
	 * Extracts the hostname from a URL for display.
	 * Shows users where the link will take them.
	 */
	const getUrlDomain = (text: string): string => {
		const url = parseUrl(text);
		return url?.hostname ?? '';
	};
</script>
