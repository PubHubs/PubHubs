<template>
	<div class="flex bg-ph-background-2">
		<div class="flex flex-col lg:min-h-[80dvh] w-full items-center lg:grid grid-cols-[10%_40%_40%_10%] xl:grid-cols-[15%_35%_35%_15%] gap-8">
			<div class="flex flex-col col-start-2 w-3/4 lg:w-full mt-10 lg:my-0">
				<slot name="column1"></slot>
			</div>
			<slot name="column2"></slot>
		</div>
	</div>
</template>
