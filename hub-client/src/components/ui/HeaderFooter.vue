<template>
	<div class="flex flex-col h-full overflow-hidden">
		<div class="h-24 bg-hub-background-2 z-10 relative">
			<slot name="header"></slot>
		</div>
		<div class="pt-2 flex-1 overflow-y-auto scrollbar">
			<slot></slot>
		</div>
		<div class="z-10">
			<slot name="footer"></slot>
		</div>
	</div>
</template>
