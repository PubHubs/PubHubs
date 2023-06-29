<template>
    <div class="flex flex-col h-screen">
        <div class="h-20 pt-4 px-4 z-10 overflow-hidden">
            <H1 class="mt-4">{{ $t('settings.title') }}</H1>
        </div>
        <Line class="m-4 mb-4"></Line>
        <div class="px-4">
            <form @submit.prevent>
                <div class="flex flex-row mb-2">
                    <label class="w-2/6">{{ $t('settings.displayname') }}</label>
                    <TextInput class="w-4/6 p-1" name="displayname" v-model="data.displayName" :placeholder="user.user.displayName" @changed="updateData('displayName',$event)" @submit="submit"></TextInput>
                </div>

                <div class="flex flex-row mb-4">
                    <label class="w-2/6">{{ $t('settings.theme') }}</label>
                    <ButtonGroup class="w-4/6" size="sm" v-model="data.theme" :value="data.theme" :options="settings.getThemeOptions($t)" @changed="updateData('theme',$event)"></ButtonGroup>
                </div>

                <div class="flex flex-row">
                    <Button @click.prevent="submit()" :disabled="!changed">{{ $t('forms.submit')}}</Button>
                </div>
            </form>
            <div v-if="message!=''" class="rounded-lg bg-red p-2 mt-2">{{message}}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { useUser, useSettings, Theme } from '@/store/store'
    import { useI18n } from 'vue-i18n';
    import { useFormState } from '@/composables/useFormState';
    import { usePubHubs } from '@/core/pubhubsStore';

    const user = useUser();
    const settings = useSettings();
    const { t } = useI18n();
    const { data, setData, updateData, dataIsChanged, changed, message, setMessage } = useFormState();
    const pubhubs = usePubHubs();

    setData({
        displayName : '',
        theme : settings.getSetTheme as Theme,
    });

    function submit() {
        console.log( 'SUBMIT' );
        if (changed.value) {
            if ( dataIsChanged('theme') ) {
                settings.setTheme(data.theme as Theme);
                setMessage(t('settings.theme_changed', [t('themes.'+data.theme)]) );
            }
            if ( dataIsChanged('displayName') ) {
                pubhubs.changeDisplayName(data.displayName as string);
                setMessage(t('settings.displayname_changed',[data.displayName]));
                updateData('displayName','');
            }
        }
    }

</script>
