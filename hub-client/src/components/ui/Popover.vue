<template>
  <div ref="elContainer" class="bg-gray-light dark:bg-gray rounded-md flex flex-col">
    <Icon v-if="showClosingCross" type="closingCross" size="base" :asButton="true" @click="close()" class="self-end mt-2 mr-2"></Icon>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import {  onMounted, ref } from 'vue';

const elContainer = ref<HTMLElement | null>(null);

const emit = defineEmits(['close']);

type Props = {
  // When clicking on outsideNode but not on the popover, the popover will be closed.
  outsideNode: EventTarget;
  // A string corresponding to an adhoc property of an event object. If that property is set to true, the click event will be ignored.
  // This is used to prevent immediately closing the popover when clicking on the button that opened it.
  ignoreClickOutside?: string;
  showClosingCross?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  showClosingCross: false,
});

onMounted(() => {
  props.outsideNode.addEventListener('click', onClickOutside);
});

export type CurrentlyOpeningEvent = MouseEvent & { [key: string]: boolean };

function onClickOutside(event: Event) {
  if (event.type !== 'click') return;
  let ev = event as CurrentlyOpeningEvent;
  if (props.ignoreClickOutside && ev[props.ignoreClickOutside] === true) return;
  if (elContainer.value && isOutisde(ev as MouseEvent, elContainer.value)) {
    close();
    props.outsideNode.removeEventListener('click', onClickOutside);
  }
}

function isOutisde(ev: MouseEvent, element: HTMLElement) {
  return !(element == ev.target || (ev.target instanceof Node && element.contains(ev.target)))
}

async function close() {
  emit('close');
}
</script>
