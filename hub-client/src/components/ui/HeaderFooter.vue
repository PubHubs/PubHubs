<template>
	<div class="flex flex-col h-screen">
		<div class="h-20 pt-4 px-3 z-10 overflow-hidden relative">
			<slot name="header"></slot>
		</div>
		<Line class="m-4 mb-0"></Line>
		<div class="flex-1 min-h-0 p-4">
			<slot></slot>
		</div>
		<div class="pb-3 px-3 z-10">
			<slot name="footer"></slot>
		</div>
	</div>
</template>
