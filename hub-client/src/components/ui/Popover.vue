<template>
	<div ref="elContainer" class="bg-hub-background-3 dark:bg-gray rounded-md flex flex-col" v-click-outside="close">
		<Icon v-if="showClosingCross" type="closingCross" size="base" :asButton="true" @click="close()" class="self-end mt-2 mr-2"></Icon>
		<div class="flex items-center">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	const emit = defineEmits(['close']);

	type Props = {
		showClosingCross?: boolean;
	};

	withDefaults(defineProps<Props>(), {
		showClosingCross: false,
	});

	async function close() {
		emit('close');
	}
</script>
