<template>
	<div v-if="attribute.length > 0" class="flex gap-x-1 pt-1">
		<div v-for="(value, index) in attribute" :key="value" :class="value === $t('rooms.admin_badge') ? 'bg-red' : bgColor(index)" class="text-white text-xs lowercase inline-block px-1 rounded h-4 flex">
			<Icon type="check" size="xs" class="mr-1" style="margin-top: 1px"></Icon>
			<span>{{ value }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRooms } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';
	import { useI18n } from 'vue-i18n';
	import filters from '@/core/filters';

	const { bgColor } = useUserColor();
	const rooms = useRooms();
	const { t } = useI18n();

	const props = defineProps({
		user: {
			type: String,
			required: true,
		},
	});

	//This logic can also handle mixed attribute
	const attribute = computed(() => {
		const currentRoom = rooms.currentRoom;
		const profileArray: any = [];
		var profileInfo = '';

		if (rooms.currentRoom && rooms.currentRoom.getCreator() === props.user) {
			profileArray.push(t('rooms.admin_badge'));
			return profileArray;
		}
		// Check until the room Notice is available.
		if (rooms.roomNotices[currentRoom.roomId] != undefined) {
			const index = rooms.roomNotices[currentRoom.roomId].findIndex((element) => element.includes(props.user));

			const attributes_in_notice = rooms.roomNotices[currentRoom.roomId][index];

			// Other admin people wont have notice. So we just return for now.
			if (attributes_in_notice === undefined) {
				return profileArray;
			}
			profileInfo = filters.extractJSONFromEventString(attributes_in_notice);
		} else {
			// Just return empty attribute if room Id is not available in the store.
			// Since we are using computed we will get the attribue for props.user
			return profileArray;
		}
		const profileInfoQouteCorrection = profileInfo.replaceAll("'", '"');
		const jsonObj = JSON.parse(profileInfoQouteCorrection);

		const keys = Object.keys(jsonObj);
		for (const key of keys) {
			// When profile attributes is false, we get empty value from backend.
			// In this case, don't add it to a list.
			if (jsonObj[key] !== '') {
				profileArray.push(jsonObj[key]);
			}
		}

		return profileArray;
	});
</script>
