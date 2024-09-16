let isInBatch = false;
let currentSignal: Signal = undefined;
const effects: Set<Effect> = new Set();
const batchDeps: Set<Signal> = new Set();

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

    if (isInBatch) {
      // remember to update all deps after batch ends
      deps.forEach(signal => {
        batchDeps.add(signal);
      });
    } else {
      // update all dependencies
      deps.forEach(signal => {
        signal.updater();
      });
    }
  }

  public updater() {}
}

class Effect {
  public isActive = true;

  private signal: Signal;
  private callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    this.signal = signal(undefined);
    this.signal.updater = this.updater.bind(this);

    effects.add(this);

    const restoreSignal = changeCurrentSignal(this.signal);
    this.callback();
    restoreSignal();
  }

  private updater() {
    if (!this.isActive) {
      return;
    }

    const restoreSignal = changeCurrentSignal(this.signal);
    this.callback();
    restoreSignal();
  }

  dispose() {
    // rm all relations
    this.signal[SUBS].forEach(sub => {
      sub[DEPS].delete(this.signal);
      this.signal[SUBS].delete(sub);
    });

    // rm from memory
    effects.delete(this);
  }
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
  const restoreSignal = changeCurrentSignal(signal)

  const updater = () => {
    const restoreSignal = changeCurrentSignal(signal);

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
    restoreSignal();
  };

  // setting up signal
  signal.updater = updater;
  signal.value = compute();

  restoreSignal();
  return signal;
}

/**
 * @description Batch will postpone reactions of computed & effect until batch end.
 * 
 * @param exec Function that mutates signal value
 * 
 * @example
 * const a = signal('a');
 * const b = signal('b');
 * 
 * effect(() => console.log(a.value + b.value)) // prints ab
 * 
 * // prints aabb;
 * batch(() => {
 *  a.value = 'aa'; // nothing will be printed here
 *  b.value = 'bb'; // nothing will be printed here
 * });
 */
export function batch(exec: () => void) {
  // already in batch, so it's a nested one
  if (isInBatch) {
    exec();
  } else {
    // first batch
    isInBatch = true;
    exec();

    batchDeps.forEach(signal => {
      signal.updater();
    });

    batchDeps.clear();
    isInBatch = false;
  }
}

/**
 * @description Changes signal to new, returns restore function
 * @param newSignal 
 */
function changeCurrentSignal(newSignal: Signal) {
  let prevSignal = currentSignal;
  currentSignal = newSignal;

  return () => {
    currentSignal = prevSignal
  };
}

/**
 * @description Effect constructor function, callback will be called every time deps change
 */
export function effect(cb: () => void) {
  return new Effect(cb);
}

/**
 * @description Signal constructor function
 */
export function signal<T>(value?: T) {
  return new Signal(value);
}