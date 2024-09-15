import { computed, effect, signal } from './index';

const a = signal('a');
const eff = effect(() => console.log(a.value));

a.value = 'aa';
eff.dispose();