<template>
	<Dialog
		:buttons="[]"
		width="w-4/5 md:w-[480px]"
		@close="emit('close')"
	>
		<template #header>
			<H2>{{ t(`videocall.permission_${state}_title`) }}</H2>
		</template>

		<p>{{ t(`videocall.permission_${state}_body`) }}</p>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import H2 from '@hub-client/components/elements/H2.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { type TPermissionNotice } from '@hub-client/models/videocall/TDeviceAccess';

	// Props
	defineProps<{
		state: TPermissionNotice;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const { t } = useI18n();
</script>
