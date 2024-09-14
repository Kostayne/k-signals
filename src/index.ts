let currentSignal: Signal = undefined;

const VALUE = Symbol.for('sig-value');
const DEPS = Symbol.for('sig-deps');
const SUBS = Symbol.for('sig-subs');

class Signal<T = any> {
  [VALUE]: T;
  [DEPS] = new Set<Signal>();
  [SUBS] = new Set<Signal>();

  constructor(value?: T) {
    this[VALUE] = value;
  }

  public get value() {
    // subscribe to computed signal
    if (currentSignal !== undefined) {
      this[DEPS].add(currentSignal);
      currentSignal[SUBS].add(this);
    }

    return this[VALUE];
  }

  public set value(value: T) {
    // value didn't change, don't do anything
    if (Object.is(value, this[VALUE])) {
      return;
    }

    this[VALUE] = value;

    // clone deps to avoid infinite loop
    const deps = new Set(this[DEPS]);

    // update all dependencies
    deps.forEach(signal => {
      signal.updater();
    });
  }

  public updater() {}
}

/**
 * @description Recomputes value on deps change
 * @param compute Compute callback
 * @example
 * const a = signal('a');
 * const tg = computed(() => a.value + '!');
 * 
 * a.value = 'aa'; 
 * console.log(tg.value) // 'aa!'
 */
export function computed(compute: () => void) {
  const signal = new Signal(undefined);

  let prevSignal = currentSignal;
  currentSignal = signal;

  const updater = () => {
    // remember prev signal
    prevSignal = currentSignal;
    currentSignal = signal;

    // deleting old signals
    signal[SUBS].forEach(sub => {
      sub[DEPS].delete(signal);
      signal[SUBS].delete(sub);
    });

    const ret = compute();
    
    if (ret !== signal[VALUE]) {
      signal.value = ret;
    }

    // restore prev signal
    currentSignal = prevSignal;
  };

  // setting up signal
  signal.updater = updater;
  signal.value = compute();

  currentSignal = prevSignal;

  return signal;
}

/**
 * @description Signal constructor function
 */
export function signal<T>(value?: T) {
  return new Signal(value);
}