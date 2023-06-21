<template>
    <div class="flex flex-col h-44 w-60 grow">
        <ImagePlaceholder src="img/imageplaceholder.jpg" class="h-24 rounded-t-md overflow-hidden"></ImagePlaceholder>

        <div class="rounded-b-md bg-white-middle text-black  dark:bg-gray dark:text-white">
            <div class="w-fit flex -mt-6 py-1 px-4 rounded-r-md bg-blue-middle-light">
                <Icon type="room" size="sm" class="text-black"></Icon>
                <p class="pl-2 text-white"><slot name="category"></slot></p>
            </div>
            <div class="flex flex-col px-4 pb-1 mt-1">
                <H3 class="font-semibold text-base"><slot name="header"></slot></H3>
                <div class="flex flex-row justify-between gap-x-8 pb-1">
                    <p class="font-normal text-xs"><slot name="content"></slot></p>
                    <button class="bg-blue-middle-light text-white rounded-sm self-end"><Icon type="arrow-right"></Icon></button>
                </div>
            </div>
        </div>
    </div>
</template>