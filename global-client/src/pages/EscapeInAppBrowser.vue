<template>
	<div class="w-full max-w-screen">
		Please
		<a :href="useRoute().query.next" target="_blank"> click here </a>
		to proceed.
	</div>

	<ul>
		<li>secure content: {{ isSecureContext }}</li>
		<li>title bar visible: {{ titleBarVisible }}</li>
		<li>standalone: {{ standalone }}</li>
		<li>storage access: {{ storageAccess }}</li>
		<li><a href="https://inappdebugger.com">in-app debugger</a></li>
	</ul>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRoute } from 'vue-router';

	const isSecureContext = window.isSecureContext;
	const titleBarVisible = navigator.windowControlsOverlay?.visible;
	const standalone = navigator.standalone;

	let storageAccess = ref(undefined);

	document.hasStorageAccess().then((result) => {
		storageAccess.value = result;
	});
</script>
