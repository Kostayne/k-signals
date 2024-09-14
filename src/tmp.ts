import { computed, signal } from './index';

const a = signal('a');
const t1 = computed(() => a.value);
const tg = computed(() => t1.value);

console.log(tg.value);

a.value = 'aa';
console.log(tg.value);