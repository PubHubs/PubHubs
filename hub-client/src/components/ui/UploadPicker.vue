<template>
	<button class="flex flex-col items-center m-2" @click="$emit('click')">
		<Icon class="dark:text-white" type="upload"></Icon>
		<p>{{ $t('message.upload_file') }}</p>
	</button>
</template>
