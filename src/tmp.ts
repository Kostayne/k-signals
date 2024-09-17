import { computed, effect, signal } from './index';

const a = signal('a');
const comp: ReturnType<typeof signal>[] = [];

for (let i = 0; i < 250; i++) {
  comp[i] = computed(() => comp[i - 1]?.value || a.value);
}

a.value = 'aa';