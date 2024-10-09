<template>
	<div class="flex bg-ph-background-2">
		<div class="flex flex-col w-full lg:min-h-[80dvh] justify-center items-center lg:grid grid-cols-[13%_37%_37%_13%] 2xl:grid-cols-[15%_35%_35%_15%] gap-8 py-8 lg:py-14">
			<div class="flex flex-col col-start-2 w-3/4 lg:w-full">
				<slot name="column1"></slot>
			</div>
			<slot name="column2"></slot>
		</div>
	</div>
</template>
