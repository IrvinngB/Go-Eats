<script setup>
import {
  Soup,
  Coffee,
  Fish,
  ShoppingCart,
  Pizza,
  Drumstick,
  Salad,
  Cake,
  Store,
} from '@lucide/vue'

const props = defineProps({
  name: {
    type: String,
    default: 'Store',
  },
  class: {
    type: String,
    default: 'w-6 h-6',
  },
})

const icons = {
  Soup,
  Coffee,
  Fish,
  ShoppingCart,
  Pizza,
  Drumstick,
  Salad,
  Cake,
  Store,
}
</script>

<template>
  <component :is="icons[props.name] || Store" :class="props.class" />
</template>
