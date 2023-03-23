/**
 *
 * Global Dialog, uses dialog.ts store. And is globally present in App.vue
 *
 */

<template>
    <div class="absolute h-screen w-screen top-0 left-0">
        <div v-if="dialog.properties.modal" class="absolute inset-0 h-screen z-0 bg-gray-middle opacity-75"></div>
        <div class="absolute inset-0 h-screen flex z-10" @click="doAction(false)">
            <div class="m-auto w-2/6 p-4 rounded-lg shadow-xl shadow-black bg-white" @click.stop>
                <div>
                    <Icon v-if="dialog.properties.close" type="close" size="md" class="float-right -mt-1 text-gray hover:text-red" @click="doAction(false)"></Icon>
                    <H2 v-if="dialog.properties.title !== ''" class="m-0 text-black text-left">{{ dialog.properties.title }}</H2>
                    <slot name="header"></slot>
                </div>
                <Line v-if="hasContent" class="text-black mb-2"></Line>
                <div v-if="hasContent" class="text-black text-left">
                    <slot></slot>
                    <div v-if="dialog.properties.content !==''">{{ dialog.properties.content }}</div>
                </div>
                <Line class="mb-3 text-black"></Line>
                <div class="flex flex-row-reverse">
                    <div v-for="(button, index) in dialog.properties.buttons" :key="index" class="ml-2">
                        <Button :color="button.color" @click="doAction(button.action)">{{ $t('dialog.'+button.label) }}</Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted,useSlots,computed } from 'vue';
    import { DialogButton, useDialog } from '@/store/dialog'

    const emit = defineEmits(['close']);
    const dialog = useDialog();
    const slots = useSlots()

    const hasContent = computed(() => {
        return slots['default'] || dialog.properties.content !=='';
    });


    const props = defineProps({
        title: {
            type: String,
            default: '',
        },
        buttons : {
            type: Array<DialogButton>,
            default: []
        }
    });


    onMounted(() => {

        if ( props.title!=='' ) {
            dialog.properties.title = props.title;
        }
        if ( props.buttons.length > 0) {
            dialog.properties.buttons = props.buttons;
        }

        document.addEventListener('keydown', (e) => {
            if (e.code == "Escape") {
                doAction(false);
            }
            if (e.code == "Enter") {
                doAction(true);
            }
        });

    });

    function doAction(action: any) {
        emit('close', action);
        dialog.close(action);
    }
</script>
