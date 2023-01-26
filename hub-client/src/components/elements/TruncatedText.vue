<template>
    <p class="truncate" :title="slotText">
        <slot></slot>
    </p>
</template>

<script setup lang="ts">
    import { useSlots, computed } from "vue";

    const slots = useSlots();
    const slotText = computed(() => {
        if ( typeof(slots.default)!='undefined' ) {
            let text:any = slots.default()[0].children;
            // Traverse children tree so this could be used inside a slot of another component
            while (typeof(text[0].children)!='undefined') {
                text = text[0].children;
            }
            return text;
        }
        return '';
    });
</script>
