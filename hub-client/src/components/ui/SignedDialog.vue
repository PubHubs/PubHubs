<template>
	<Icon type="check-circle" @click="togglePopup()" class="cursor-pointer"></Icon>

	<Dialog v-if="showPopup" :title="$t('roomlibrary.signed_info')" :buttons="buttonsOk" @close="togglePopup()">
		<p>{{ $t('roomlibrary.used_attribute') }} '{{ attributes.toString() }}' {{ $t('roomlibrary.with_value') }} '{{ displayDisclosedAttribute.toString() }}'</p>

		<p class="mt-2">
			<a class="flex gap-2" v-if="fileUrl" :href="fileUrl" :download="fileName">
				<span>{{ $t('roomlibrary.download_info') }}</span>
				<IconButton type="download-simple"></IconButton>
			</a>
		</p>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { TFileMessageEventContent, TSignedMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { buttonsOk } from '@hub-client/stores/dialog';

	const showPopup = ref(false);
	const fileUrl = ref<string>('');
	const fileName = ref<string>('');

	const props = defineProps<{
		event: any;
		originalEvent: any;
		room: Room;
		attributes: string[];
	}>();

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
		fileUrl.value = window.URL.createObjectURL(blob);
		// Download as the correct file type
		if (originalEventContent.value.filename) {
			let split = originalEventContent.value.filename.split('.');
			split.pop();
			fileName.value = 'Signed_' + split.join() + '.json';
		}
	});

	function togglePopup() {
		showPopup.value = !showPopup.value;
	}
</script>
