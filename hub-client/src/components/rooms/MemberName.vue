<template>
	{{ label }}
</template>

<script lang="ts" setup>
	// Packages
	import { computed, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Composables
	import { useDeactivatedUsers } from '@hub-client/composables/useDeactivatedUsers';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	/**
	 * The name of a room member, as a bare string.
	 *
	 * `rawDisplayName` falls back to the Matrix id when a member has no display name of their
	 * own, and in PubHubs that id *is* their pseudonym - the handle others recognise them by.
	 * An account that has been deleted has no display name left, so rendering it directly would
	 * put the pseudonym of someone who asked to be gone back on screen.
	 */
	const props = withDefaults(defineProps<Props>(), {
		rawDisplayName: undefined,
	});

	type Props = {
		rawDisplayName?: string;
		userId: string;
	};

	const { t } = useI18n();
	const user = useUser();
	const { ensureKnown } = useDeactivatedUsers();

	const label = computed(() => (user.isDeactivatedUser(props.userId) ? t('others.deleted_account') : (props.rawDisplayName ?? '')));

	// Only names we cannot account for are worth asking about: a member of the room carries a
	// display name of their own, and the fallback to the Matrix id is what gives the others away.
	watch(
		() => [props.userId, props.rawDisplayName] as const,
		([userId, rawDisplayName]) => {
			if (userId && (!rawDisplayName || rawDisplayName === userId)) ensureKnown([userId]);
		},
		{ immediate: true },
	);
</script>
