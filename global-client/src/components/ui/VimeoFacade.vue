<template>
	<div
		class="relative aspect-video w-full overflow-hidden shadow-xl"
		:class="rounded && 'rounded-2xl'"
	>
		<button
			v-if="!playing"
			class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3"
			:aria-label="$t('register.video_click_to_play')"
			@click="playing = true"
		>
			<img
				src="@global-client/assets/yivi-video-thumbnail.jpg"
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
			/>
			<div class="bg-accent-primary relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="h-8 w-8 translate-x-0.5"
				>
					<path d="M8 5v14l11-7z" />
				</svg>
			</div>
			<p class="text-white drop-shadow">{{ $t('register.video_click_to_play') }}</p>
		</button>
		<iframe
			v-else
			:src="`https://player.vimeo.com/video/${videoId}?badge=0&autopause=0&player_id=0&app_id=58479&dnt=1&autoplay=1`"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
			class="absolute inset-0 h-full w-full"
			frameborder="0"
			:title="title"
		/>
	</div>
</template>

<script lang="ts" setup>
	import { ref } from 'vue';

	defineProps<{
		videoId: string;
		title?: string;
		rounded?: boolean;
	}>();

	const playing = ref(false);
</script>
