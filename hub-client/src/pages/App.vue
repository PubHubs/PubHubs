<template>
    <div :class="settings.getActiveTheme">
        <div class="w-screen h-screen bg-white text-black dark:bg-blue-dark dark:text-white">

            <div v-if="user.isLoggedIn" class="grid grid-cols-8">
                <HeaderFooter class="col-span-2">
                    <template #header>
                        <router-link to="/">
                            <Badge v-if="rooms.totalUnreadMessages>0" class="-ml-2 -mt-2">{{rooms.totalUnreadMessages}}</Badge>
                            <Logo class="h-4/5"></Logo>
                        </router-link>
                    </template>

                    <Menu>
                        <router-link to="/" v-slot="{ isActive }">
                            <MenuItem icon="home" :active="isActive">{{ $t("menu.home") }}</MenuItem>
                        </router-link>
                        <MenuItem>{{ $t("menu.calender") }}</MenuItem>
                        <MenuItem>{{ $t("menu.tool") }}</MenuItem>
                    </Menu>

                    <Toggler class="mt-12">
                        <template #title>
                            <H2 class="mt-0">{{ $t("menu.rooms") }}</H2>
                        </template>
                        <template #content="toggler">
                            <Line></Line>
                            <RoomList :edit="toggler.state"></RoomList>
                        </template>
                    </Toggler>

                    <div class="mt-12">
                        <H2>{{ $t("menu.private_rooms") }}</H2>
                        <Line></Line>
                    </div>
                    <Menu>
                        <MenuItem>{{ $t("menu.name") }}</MenuItem>
                    </Menu>

                    <template #footer>
                        <Menu>
                            <router-link :to="{ name: 'settings', params: {} }" v-slot="{ isActive }">
                                <MenuItem icon="cog" :active="isActive">
                                    {{ $t("menu.settings") }}
                                </MenuItem>
                            </router-link>
                            <router-link v-if="user.isLoggedIn" :to="{ name: 'logout', params: {} }" v-slot="{ isActive }">
                                <MenuItem icon="power" :active="isActive" >
                                    {{ $t("menu.logout") }}&nbsp;<span v-if="user.user.displayName" :title="user.user.displayName">[{{filters.matrixDisplayName(user.user.displayName)}}]</span>
                                </MenuItem>
                            </router-link>
                        </Menu>
                    </template>
                </HeaderFooter>

                <div v-if="rooms.hasRooms" class="col-span-6 overflow-auto">
                    <router-view></router-view>
                </div>
            </div>

        </div>
    </div>

</template>

<script setup lang="ts">
    import filters from "@/core/filters";

    import { useSettings, useUser, useRooms } from '@/store/store'

    const settings = useSettings();
    const user = useUser();
    const rooms = useRooms();


</script>
