<template>
    <div :class="settings.getActiveTheme">
        <div class="w-screen h-screen bg-white text-black dark:bg-gray-dark dark:text-white">

            <div v-if="user.isLoggedIn" class="grid grid-cols-8">
                <HeaderFooter class="col-span-2">
                    <template #header>
                        <router-link to="/">
                            <Badge v-if="hubSettings.isSolo && rooms.totalUnreadMessages>0" class="-ml-2 -mt-2">{{rooms.totalUnreadMessages}}</Badge>
                            <Logo class="absolute h-2/5 bottom-3"></Logo>
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
                                <MenuItem icon="cog" :active="isActive"></MenuItem>
                            </router-link>
                        </Menu>
                    </template>
                </HeaderFooter>

                <div class="col-span-6 overflow-auto bg-white dark:bg-gray-middle">
                    <router-view></router-view>
                </div>
            </div>

            <div v-else>
                <router-view></router-view>
            </div>

        </div>

        <Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>

    </div>

</template>

<script setup lang="ts">
import {onMounted} from 'vue';
import {RouteParamValue, useRouter} from 'vue-router'
import {
  Message,
  MessageBoxType,
  MessageType,
  Theme,
  useDialog,
  useHubSettings,
  useMessageBox,
  useRooms,
  useSettings,
  useUser
} from '@/store/store'
import {usePubHubs} from '@/core/pubhubsStore';

const router = useRouter();
    const settings = useSettings();
    const hubSettings = useHubSettings();
    const user = useUser();
    const rooms = useRooms();
    const messagebox = useMessageBox();
    const dialog = useDialog();
    const pubhubs = usePubHubs();

    onMounted(() => {
        if ( window.location.hash!=='#/hub/' ) {
            pubhubs.login();
            router.push({name:'home'});
        }
        startMessageBox();
    })


    async function startMessageBox() {
        if ( ! hubSettings.isSolo ) {

            await messagebox.init( MessageBoxType.Child, hubSettings.parentUrl );

            // Listen to roomchange
            messagebox.addCallback( MessageType.RoomChange, (message:Message) => {
                const roomId = message.content as RouteParamValue;
                if ( rooms.currentRoomId !== roomId ) {
                    router.push({name:'room',params:{id:roomId}});
                }
            });

            // Listen to sync settings
            messagebox.addCallback( MessageType.Settings, (message:Message) => {
                settings.setTheme(message.content as Theme);
            });

            //Listen to log in time
            messagebox.addCallback( MessageType.GlobalLoginTime, (message:Message) => {
              pubhubs.updateLoggedInStatusBasedOnGlobalStatus(message.content as string);
            });

        }
    }





</script>
