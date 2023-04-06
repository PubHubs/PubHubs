<template>
    <div :class="settings.getActiveTheme">

        <div class="w-screen h-screen bg-white text-black dark:bg-gray-darker dark:text-white">

            <div class="flex">
                <div id="pubhubs-bar" class="flex-none w-20 sm:w-32 flex flex-col h-screen pt-2">
                    <Modal :show="global.isModalVisible">
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
                    </Modal>
                </div>

                <div class="flex-1 dark:bg-gray-dark">
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
        // console.clear();
        dialog.asGlobal();

        /*global _env */
        /*eslint no-undef: "error"*/
        console.info('Global ENV',_env);

        global.checkLogin().finally(()=>{
            // hubs.addHub( new Hub('local','http://localhost:8081','Local') );
            // hubs.addHub( new Hub('main','https://main.testhub-element.ihub.ru.nl','Main Hub') );
            global.getHubs().then((hubsResponse:any) => {
                hubs.addHubs(hubsResponse as Array<Hub>);
            });
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
