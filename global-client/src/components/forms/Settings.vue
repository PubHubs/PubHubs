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
    import { useSettings } from '@/store/store'
    import { useFormState } from '@/composables/useFormState';
    import { useDialog } from '@/store/store';

    const { data, setData, updateData, dataIsChanged, changed } = useFormState();
    const settings = useSettings();
    const dialog = useDialog();

    setData({
        displayName : '',
        theme : settings.getSetTheme as string,
    });


    onMounted(() => {
        dialog.addCallback(true,()=>{
            if (changed) {
                if ( dataIsChanged('theme') ) {
                    settings.setTheme(data.theme);
                }
            }
        });
    });

</script>
