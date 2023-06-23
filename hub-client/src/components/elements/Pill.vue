<template>
    <div class="flex flex-row rounded-md bg-white-middle text-black dark:bg-gray dark:text-white overflow-hidden">
        <div class="w-3 bg-blue-middle-light"></div>           
        <div class="flex flex-col px-4 pb-1 mt-1">
            <H3 class="font-semibold text-base"><slot name="header"></slot></H3>
            <p class="font-normal text-xs"><slot name="content"></slot></p>
        </div>
        </div>
</template>
