<template>
	<div class="flex flex-col h-full overflow-hidden">
		<div class="h-16 md:h-20 z-10 relative">
			<slot name="header"></slot>
		</div>
		<div class="flex-1 py-1 overflow-y-auto scrollbar">
			<slot></slot>
		</div>
		<div class="py-3 z-10">
			<slot name="footer"></slot>
		</div>
	</div>
</template>
