<template>
<div class="flex items-center rounded-md">
  <button class="flex flex-col items-center m-2" @click="$emit('attachment', $event)">
    <Icon class="dark:text-white" type="upload"></Icon>
    <p>{{ $t('message.upload_file') }}</p>
  </button>

  <button class="flex flex-col items-center m-2" @click="$emit('sign', $event)">
    <Icon class="dark:text-white" type="sign"></Icon>
    <p>{{ $t('message.sign.add_signature') }}</p>
  </button>
</div>
</template>

<script setup lang="ts">


</script>
