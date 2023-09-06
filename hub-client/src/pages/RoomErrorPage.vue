<template>
	<div class="flex justify-center items-center h-screen dark:text-white p-10">
		<div class="text-center">
			<h1 class="text-6xl font-bold mb-8">Oops!</h1>
			<h2 class="text-2xl font-semibold mb-4">{{ $t('rooms.access_denied') }}</h2>
			<p class="text-lg mb-4">{{ $t('rooms.secured_room_error') }}</p>
			<router-link :to="{ name: 'home' }"><Button>Go back</Button></router-link>
		</div>
	</div>
</template>
