<template>
    <div class="flex flex-col">
        <div class="flex justify-between">
            <label>{{ $t('settings.theme') }}</label>
            <ButtonGroup size="sm" v-model="data.theme" :value="data.theme" :options="settings.getThemeOptions($t)" @changed="updateData('theme',$event)"></ButtonGroup>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue'
    import { useSettings, Theme } from '@/store/store'
    import { useFormState, FormDataType } from '@/composables/useFormState';
    import { useDialog, DialogTrue } from '@/store/store';

    const { data, setData, updateData, dataIsChanged, changed } = useFormState();
    const settings = useSettings();
    const dialog = useDialog();

    setData({
        displayName : '' as FormDataType,
        theme : settings.getSetTheme as FormDataType,
    });


    onMounted(() => {
        dialog.addCallback(DialogTrue,()=>{
            if (changed) {
                if ( dataIsChanged('theme') ) {
                    settings.setTheme( data.theme as Theme);
                }
            }
        });
    });

</script>
