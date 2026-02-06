<template>
	<div class="h-full w-full max-w-screen items-center justify-center p-20 text-center">
		<h1 class="text-accent-primary">{{ $t('errors.oops') }}</h1>
		<p>{{ $t('register.inapp.in_yivi') }}</p>
		<p>
			<strong>{{ $t('register.inapp.reobtain_not_possible') }}</strong>
		</p>
		<p>{{ $t('register.inapp.go_to_pubhubs_directly') }}</p>
		<p></p>
		<p>{{ $t('register.inapp.youll_get_card') }}</p>
	</div>

	<ul>
		<li>Some technical stuff to help our developers debug:</li>
		<li>secure context: {{ isSecureContext }}</li>
		<li>title bar visible: {{ titleBarVisible }}</li>
		<li>standalone: {{ standalone }}</li>
		<li>storage access: {{ storageAccess }}</li>
		<li>referrer: {{ referrer }}</li>
		<li>
			<u><a href="https://inappdebugger.com">in-app debugger</a></u>
		</li>
		<li>
			<u><a :href="'x-safari-' + next">Or open in Safari instead</a></u>
		</li>
		<li>
			<u><a :href="'intent://' + nextWithoutScheme + '#Intent;scheme=https;end'">Or open using an intent link</a></u>
		</li>
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
