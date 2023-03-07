<template>
    <p class="mt-2" v-html="body"></p>
</template>

<script setup lang="ts">
    import {computed} from 'vue';

    const props = defineProps({
        message: {
            type: String,
            required:true,
        },
    });

    /**
     *
     * Find 'reply to' in the message and give it some styling.
     *
     */
    const body = computed(()=>{
        let body = props.message;
        body = body.replace(/^>\s*<([^>]*)>(.*)\n\n(.*)/g, "<div class=\"text-white rounded-lg p-1\">`<span class=\"text-gray-300\">$1</span> : $2`</div>$3");
        return body;
    });

</script>
