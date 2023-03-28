<template>
    <div :class="settings.getActiveTheme">

        <div class="w-screen h-screen bg-white text-black dark:bg-gray-darker dark:text-white">

            <div class="grid grid-cols-8">
                <div class="col-span-1 flex flex-col h-screen p-4">
                    <div class="flex-1 text-center">
                        <router-link to="/" v-slot="{ isActive }">
                            <HubIcon type="home" :active="isActive"></HubIcon>
                        </router-link>

                        <router-link v-for="hub in hubs.sortedHubsArray" :key="hub.hubId" :to="{ name: 'hub', params: { 'id':hub.hubId } }" v-slot="{ isActive }">
                            <HubIcon :hub="hub" :active="isActive"></HubIcon>
                        </router-link>
                    </div>

                    <div class="text-center" v-if="global.loggedIn">
                        <HubIcon type="cog" @click="settingsDialog = true"></HubIcon>
                        <Dialog v-if="settingsDialog" @close="settingsDialog=false" :title="$t('settings.title')" :buttons="buttonsSubmitCancel">
                            <Settings></Settings>
                        </Dialog>
                        <HubIcon type="power" @click="logout()"></HubIcon>
                    </div>
                </div>

                <div class="col-span-7 dark:bg-gray-dark">
                    <router-view></router-view>
                </div>
            </div>

        </div>

        <Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>

    </div>

</template>

<script setup lang="ts">
    import { onMounted,ref } from 'vue';
    import { useGlobal, useSettings, Hub, useHubs, buttonsSubmitCancel, useDialog } from '@/store/store'
    import { useI18n } from 'vue-i18n';

    const global = useGlobal();
    const settings = useSettings();
    const hubs = useHubs();
    const dialog = useDialog();
    const settingsDialog = ref(false);
    const { t } = useI18n();

    onMounted(() => {
        console.clear();

        global.checkLogin().then( ()=>{

            if ( global.loggedIn ) {

                // TODO: for now just some local test hubs
                hubs.addHub( new Hub('local','http://localhost:8081','Local') );
                hubs.addHub( new Hub('main','https://main.testhub-element.ihub.ru.nl','Main Hub') );
                hubs.addHub( new Hub('stable','https://stable.testhub-element.ihub.ru.nl','Stable Hub') );
                hubs.addHub( new Hub('test2','https://main.testhub2-element.ihub.ru.nl','Test Hub 2') );

            }


        });
    });


    function logout() {
        dialog.yesno( t("logout.logout_sure") ).then((answer) => {
            if (answer) {
                global.logout();
            }
        });
    }


</script>
