<template>
    <div>
        <H1>{{ $t('settings.title') }}</H1>
        <form @submit.prevent>
            <div class="flex flex-row mb-2">
                <label class="w-2/6">{{ $t('settings.displayname') }}</label>
                <TextInput class="w-4/6 p-1" name="displayname" v-model="data.displayName" :placeholder="user.user.displayName" @changed="updateData('displayName',$event)"></TextInput>
            </div>

            <div class="flex flex-row mb-4">
                <label class="w-2/6">{{ $t('settings.theme') }}</label>
                <ButtonGroup class="w-4/6" size="sm" v-model="data.theme" :value="data.theme" :options="settings.getThemeOptions($t)" @changed="updateData('theme',$event)"></ButtonGroup>
            </div>

            <div class="flex flex-row">
                <Button @click.prevent="submit()" :disabled="!changed">{{ $t('forms.submit')}}</Button>
            </div>
        </form>
    </div>
    <div v-if="message!=''" class="rounded-lg bg-red p-2 mt-2">
        {{message}}
    </div>
</template>

<script setup lang="ts">
    import { inject } from 'vue';
    import { useUser, useSettings } from '@/store/store'
    import { useI18n } from 'vue-i18n';
    import { useFormState } from '@/composables/useFormState';
    const { data, setData, updateData, dataIsChanged, changed, message, setMessage } = useFormState();
    const { t } = useI18n();
    const user = useUser();
    const settings = useSettings();
    const pubhubs:any = inject('pubhubs');

    setData({
        displayName : '',
        theme : settings.getSetTheme as string,
    });

    function submit() {
        if (changed) {
            if ( dataIsChanged('displayName') ) {
                pubhubs.changeDisplayName(data.displayName);
                setMessage(t('settings.displayname_changed',[data.displayName]));
                updateData('displayName','');
            }
            if ( dataIsChanged('theme') ) {
                settings.setTheme(data.theme);
                setMessage(t('settings.theme_changed', [t('themes.'+data.theme)]) );
            }
        }
    }

</script>
