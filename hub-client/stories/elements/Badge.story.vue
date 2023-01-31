<template>
    <Story title="Elements/Badge" :layout="{ type: 'grid', width: '30%' }">
        <Variant title="1 karakter">
            <Badge>5</Badge>
        </Variant>
        <Variant title="2 karakters">
            <Badge>50</Badge>
        </Variant>
        <Variant title="3 karakters">
            <Badge>505</Badge>
        </Variant>
    </Story>
</template>

<script setup lang="ts">
    import Badge from '@/components/elements/Badge.vue';
</script>
