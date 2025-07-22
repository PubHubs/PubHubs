<template>
	<Icon type="checkmark" @click="togglePopup()" class="cursor-pointer"></Icon>

	<Dialog v-if="showPopup" :title="$t('roomlibrary.signed_info')" :buttons="buttonsOk" @close="togglePopup()">
		<p>{{ $t('roomlibrary.used_attribute') }} '{{ attributes.toString() }}' {{ $t('roomlibrary.with_value') }} '{{ displayDisclosedAttribute.toString() }}'</p>

		<p class="mt-2">
			<a class="flex gap-2" v-if="fileUrl" :href="fileUrl" :download="fileName">
				<span>{{ $t('roomlibrary.download_info') }}</span>
				<Icon :type="'download'" :asButton="true"></Icon>
			</a>
		</p>
	</Dialog>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { TFileMessageEventContent, TSignedMessageEventContent } from '@/model/events/TMessageEvent';
	import { onMounted, computed, ref } from 'vue';
	import Room from '@/model/rooms/Room';
	import { buttonsOk } from '@/logic/store/dialog';

	const props = defineProps<{
		event: any;
		originalEvent: any;
		room: Room;
		attributes: string[];
	}>();

	const showPopup = ref(false);

	const fileUrl = ref<string>('');
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
