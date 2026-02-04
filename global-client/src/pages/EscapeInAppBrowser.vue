<template>
	<div class="w-full max-w-screen">
		Please
		<strong><a :href="next" target="_blank"> click here </a></strong>
		to proceed.
	</div>

	<ul>
		<li>secure context: {{ isSecureContext }}</li>
		<li>title bar visible: {{ titleBarVisible }}</li>
		<li>standalone: {{ standalone }}</li>
		<li>storage access: {{ storageAccess }}</li>
		<li>referrer: {{ referrer }}</li>
		<li><a href="https://inappdebugger.com">in-app debugger</a></li>
		<li><a :href="'x-safari-' + next">Or open in Safari instead</a></li>
		<li><a :href="'intent://' + nextWithoutScheme + '#Intent;scheme=https;end'">Or open using an intent link</a></li>
	</ul>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useRoute } from 'vue-router';

	const next = useRoute().query.next;
	const nextWithoutScheme = next.replace(/^[a-zA-Z0-9]*:\/\//, '');

	const isSecureContext = window.isSecureContext;
	const titleBarVisible = navigator.windowControlsOverlay?.visible;
	const standalone = navigator.standalone;
	const referrer = document.referrer;

	let storageAccess = ref(undefined);

	document.hasStorageAccess().then((result) => {
		storageAccess.value = result;
	});
</script>
