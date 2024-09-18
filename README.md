# K Signals

Signals are about universal state management, they are performant and will notify only actual dependencies. No need in creating your own specific state manager.

## Installation
Use package manager to install the library

```sh
npm i k-signals # npm
bun a k-signals # bun
yarn add k-signals # yarn
```

## Table of content
- [Signal](#signaltinitvalue-t)
- [Computed](#computedtcb---t-t)
- [Effect](#effect--void)
- [Batch](#batchcb---void)
- [Watch](#watchcb---void-deps-signal)

## Docs
### `signal<T>(initValue: T)`
```ts
import { signal } from 'k-signal';

const a = signal('a');
console.log(a.value); // a

a.value = 'aa';
console.log(a.value); // aa
```

Creates a signal with init value.

#### `signal.peek()`
```ts
const a = signal('a');
effect(() => console.log(a.peek())); // prints a

a.value = 'aa'; // prints nothing
```

Peek method used to get signal value without subscribing to it.

### `computed<T>(cb: () => T): T`
```ts
import { signal, computed } from 'k-signal';

const a = signal(1);
const doubled = computed(() => a.value * 2);

console.log(doubled.value); // 2

a.value = 2;
console.log(doubled.value); // 4
```

Computes new value based on the other value. Updates computed value every time dependencies change.


### `effect(() => void)`
```ts
import { signal, effect } from 'k-signal';

const a = signal(1);
const eff = effect(() => console.log(a.value)); // prints 1

a.value = 2; // prints 2

eff.isActive = false;
a.value = 3; // prints nothing
```

Immediately run an effect, reruns on dependencies change. Can be turned off by setting `isActivated` to false.

<!-- #### Dispose methonds -->
#### `effect.dispose()`
```ts
const eff = effect(() => {});

eff.onDispose = () => {
  console.log(`Disposed`);
};

eff.dispose(); // prints disposed
```

Dispose method will unsubscribe dependencies and deactivate effect.


### `batch(cb: () => void)`
```ts
import { signal, computed, batch, effect } from 'k-signal';

const a = signal('a');
const b = signal('b');

const comp = computed(() => a.value + b.value);

// prints ab
effect(() => {
  console.log(comp.value);
});

// prints aabb
batch(() => {
  a.value = 'aa';
  b.value = 'bb';
});
```

Batch function will postpone all effects execution until batch complete.
Use batch to avoid getting transient values.

### `watch(cb: () => void, deps: Signal[])`
```ts
import { signal, watch } from 'k-signal';

const a = signal('a');
const b = signal('b');

watch(() => { console.log(a.value); console.log(b.value) }, [a]);

a.value = 'aa'; // prints aa, b
b.value = 'bb'; // prints nothing
```

The watch function is not called immediately like effect function does and also listens only provided dependencies.

