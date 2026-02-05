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
		<li>isInApp: {{ isInApp }}</li>
		<li>appKey: {{ appKey }}</li>
		<li>appName: {{ appName }}</li>
		<li>isSFSVC: {{ isSFSVC }}</li>
	</ul>
</template>

<script setup lang="ts">
	import InAppSpy, { SFSVCExperimental } from 'inapp-spy';
	import { ref } from 'vue';
	import { useRoute } from 'vue-router';

	let isSFSVC = ref(undefined);

	SFSVCExperimental().then((result) => {
		isSFSVC.value = result;
	});

	const next = useRoute().query.next;
	const nextWithoutScheme = next.replace(/^[a-zA-Z0-9]*:\/\//, '');

	const { isInApp, appKey, appName } = InAppSpy();

	const isSecureContext = window.isSecureContext;
	const titleBarVisible = navigator.windowControlsOverlay?.visible;
	const standalone = navigator.standalone;
	const referrer = document.referrer;

	let storageAccess = ref(undefined);

	document.hasStorageAccess().then((result) => {
		storageAccess.value = result;
	});
</script>
