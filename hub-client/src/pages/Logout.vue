<template>
    <div>
        <H1>{{ $t("logout.logout") }}</H1>
    </div>
</template>

<script setup lang="ts">
    import { inject, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { useI18n } from 'vue-i18n';

    const router = useRouter()
    const { t } = useI18n();
    const pubhubs:any = inject('pubhubs');

    onMounted(() => {
        if ( confirm( t("logout.logout_sure") ) ) {
            pubhubs.logout();
        }
        else {
            router.go(-1);
        }
    });
</script>
