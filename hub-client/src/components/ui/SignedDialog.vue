<template>
	<Icon
		class="cursor-pointer"
		type="check-circle"
		@click="togglePopup()"
	/>

	<Dialog
		v-if="showPopup"
		:buttons="buttonsOk"
		:title="$t('roomlibrary.signed_info')"
		@close="togglePopup()"
	>
		<p>
			{{ $t('roomlibrary.used_attribute') }} '{{ attributes.toString() }}' {{ $t('roomlibrary.with_value') }} '{{ displayDisclosedAttribute.toString() }}'
		</p>

		<p class="mt-2">
			<a
				v-if="fileUrl"
				class="flex gap-2"
				:download="fileName"
				:href="fileUrl.url"
			>
				<span>{{ $t('roomlibrary.download_info') }}</span>
				<IconButton type="download-simple" />
			</a>
		</p>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, onUnmounted, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Models
	import { type TFileMessageEventContent, type TSignedMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { buttonsOk } from '@hub-client/stores/dialog';

	const props = defineProps<{
		event: { content: TSignedMessageEventContent };
		originalEvent: { content: TFileMessageEventContent };
		room: Room;
		attributes: string[];
	}>();
	const showPopup = ref(false);
	const fileUrl = ref<BlobManager>();
	const fileName = ref<string>('');

	const signedMessage = computed((): TSignedMessageEventContent => {
		return props.event.content;
	});

	const originalEventContent = computed((): TFileMessageEventContent => {
		return props.originalEvent.content;
	});

	const displayDisclosedAttribute = computed(() => {
		const disclosed = signedMessage.value.signed_message.disclosed;
		const rawValue = disclosed.flatMap((innerArray) => innerArray.map((item) => item.rawvalue));
		return rawValue;
	});

	onMounted(() => {
		const blob = new Blob([JSON.stringify(signedMessage.value.signed_message)], { type: 'application/json' });
		fileUrl.value = new BlobManager(blob);
		// Download as the correct file type
		if (originalEventContent.value.filename) {
			let split = originalEventContent.value.filename.split('.');
			split.pop();
			fileName.value = 'Signed_' + split.join() + '.json';
		}
	});

	onUnmounted(() => {
		fileUrl.value?.revoke();
	});

	function togglePopup() {
		showPopup.value = !showPopup.value;
	}
</script>
