<template>
    <Button class="float-right absolute -top-11 right-0" @click="loadOldMessages()">
        <Icon type="chevron-up"></Icon>
    </Button>
</template>

<script setup lang="ts">
    import { inject } from 'vue';
    const pubhubs:any = inject('pubhubs');

    const emit = defineEmits(['loaded'])

    const props = defineProps({
        room_id: {
            type: String,
            required: true,
        },
    });

    function loadOldMessages() {
        pubhubs.loadOlderEvents(props.room_id);
        emit('loaded');
    }

</script>
