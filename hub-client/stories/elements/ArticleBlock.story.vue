<template>
    <Story title="Elements/ArticleBlock">
        <ArticleBlock :image="''">
            <template #header>Lorem ipsum</template>
            <template #category>Dolor</template>
            <template #content>Sit amet, consectetur adipiscing elit.</template>
        </ArticleBlock>
    </Story>
</template>

<script setup lang="ts">
    import ArticleBlock from '@/components/elements/ArticleBlock.vue';
</script>
