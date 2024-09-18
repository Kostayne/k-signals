import { computed, effect, signal } from './index';

const a = signal('a');

const comp = computed(() => {
  throw new Error('Bad computed =(');
});
