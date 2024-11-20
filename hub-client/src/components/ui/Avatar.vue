<template>
	<div class="rounded-full w-12 h-12 aspect-square flex items-center justify-center overflow-hidden" :class="bgColor(color(userId))">
		<!-- If image is passed as props then render the image on Avatar-->
		<img v-if="image !== ''" data-testid="avatar" :src="image" class="rounded-full w-full h-full" />
		<!-- Otherwise  show  icon -->
		<Icon v-else size="lg" type="person"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useUserColor } from '@/composables/useUserColor';
	import Room from '@/model/rooms/Room';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	const downloadUrl = useMatrixFiles();
	const { color, bgColor } = useUserColor();

	interface Props {
		userId: string;
		// img is used when avatar is uploaded or removed.
		img?: string;
		// To fetch the latest avatar when in room for each member.
		room?: Room;
	}

	const props = withDefaults(defineProps<Props>(), {
		// Default value: To check if img is not set from settings dialog box.
		img: '',
		room: undefined,
	});

	const image = computed(() => {
		if (props.room) {
			const memberAvatarMxcUrl = props.room.getMember(props.userId)?.getMxcAvatarUrl();
			return memberAvatarMxcUrl ? downloadUrl.formUrlfromMxc(memberAvatarMxcUrl) : '';
		}

		// When there is props.img passed, then use the props.img.
		return props.img === '' ? '' : downloadUrl.formUrlfromMxc(props.img);
	});
</script>
