<template>
    <div class="flex flex-col h-screen">
        <div class="h-12 pt-4 px-4 z-10 bg-white overflow-hidden">
            <slot name="header"></slot>
        </div>
        <Line class="m-4 mb-0"></Line>
        <div class="flex-1 overflow-y-auto p-4">
            <slot></slot>
        </div>
        <div class="pb-4 px-4 z-10 bg-white">
            <slot name="footer"></slot>
        </div>
    </div>
</template>

<style scoped>
    .header {
        /* height: 5rem; */
    }

</style>
