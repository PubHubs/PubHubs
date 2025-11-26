<template>
	<div class="bg-surface-low flex">
		<div class="flex w-full grid-cols-[13%_37%_37%_13%] flex-col items-center justify-center gap-8 py-8 lg:grid lg:min-h-[80dvh] lg:py-14 2xl:grid-cols-[15%_35%_35%_15%]">
			<div class="col-start-2 flex w-3/4 flex-col lg:w-full">
				<slot name="column1"></slot>
			</div>
			<slot name="column2"></slot>
		</div>
	</div>
</template>
