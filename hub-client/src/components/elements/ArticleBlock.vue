<template>
    <div class="flex flex-col w-5/12">

        <slot name="image">
            <div class="min-h-[4rem]  grow rounded-t-md bg-gradient-to-t from-blue-light via-avatar-blue to-blue"></div>
        </slot>


        <div class="rounded-b-md  bg-white text-black">
            <div class="w-fit flex -mt-6 py-1 px-4 rounded-r-md bg-green-lighter">
                <Icon type="room" size="sm"></Icon>
                <p class="pl-2"><slot name="category"></slot></p>
            </div>
            <div class="flex flex-col px-4 pb-1 mt-1">
                <H3><slot name="header"></slot></H3>
                <p class="-mt-1 truncate"><slot name="content"></slot></p>
            </div>
        </div>
    </div>
    
</template>
