<template>
	<span v-if="attribute.length > 0" class="mb-4">
		<span v-for="(value, index) in attribute" :key="value" :class="value === 'Admin' ? 'bg-red' : bgColor(index)" class="text-white font-bold inline-block p-2 mr-2 rounded">
			{{ value }}
		</span>
	</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRooms } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';
	import { useUserName } from '@/composables/useUserName';
	import { useI18n } from 'vue-i18n';

	const { getUserDisplayName } = useUserName();
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

		const displayName = getUserDisplayName(props.user, currentRoom);

		const profileInfo = rooms.getBadgeInSecureRoom(currentRoom.roomId, displayName);

		// For handling non-secured room case, where we dont get any information from backend.
		// For non-secured room, we always return an empty profile information.
		// We can add a v-if statement in profileattribute component. This check is simple here to add.
		if (profileInfo.length == 0 && !rooms.roomIsSecure(currentRoom.roomId)) {
			return profileArray;
		}

		//Admin badge handling for secured room. We set profileArray to admin.
		if (profileInfo.length == 0 && rooms.roomIsSecure(currentRoom.roomId)) {
			profileArray.push(t('rooms.admin_badge'));
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
