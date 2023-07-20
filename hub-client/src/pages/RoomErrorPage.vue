<template>
	<div class="flex justify-center items-center h-screen bg-gray-900 text-white">
		<div class="text-center">
			<h1 class="text-6xl font-bold mb-8">Oops!</h1>
			<h2 class="text-2xl font-semibold mb-4">{{ $t('rooms.access_denied') }}</h2>
			<p class="text-lg mb-4">{{ $t('rooms.secured_room_error') }}</p>
			<button class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded">Go back</button>
		</div>
	</div>
</template>
