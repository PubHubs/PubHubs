<template>
	<div class="flex flex-row items-center gap-1 break-words">
		<button @click="$router.push({ name: 'create-topic' })" class="bg-accent-primary text-on-accent-primary inline-flex items-center gap-2 rounded-[8px] px-4 py-[10px] font-bold transition-colors duration-300 hover:bg-sky-700">
			Add New
		</button>
	</div>
</template>
