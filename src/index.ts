let isInBatch = false;
let currentEffect: Effect | undefined = undefined;

const effects: Set<Effect> = new Set();
const batchDeps: Set<Effect> = new Set();

const VALUE = Symbol.for('sig-value');
const DEPS = Symbol.for('sig-deps');
const SUBS = Symbol.for('sig-subs');
const EFFECT_CB = Symbol.for('eff-cb');

class Signal<T = any> {
  [VALUE]: T;
  [DEPS] = new Set<Effect>();

  constructor(value?: T) {
    this[VALUE] = value!;
  }

  public get value() {
    // subscribe to compute effect
    if (currentEffect !== undefined) {
      this[DEPS].add(currentEffect);
      currentEffect[SUBS].add(this);
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
      deps.forEach(effect => {
        batchDeps.add(effect);
      });
    } else {
      // update all dependencies
      deps.forEach(effect => {
        effect.exec();
      });
    }
  }

  public updater() {}
}

class Effect {
  public isActive: boolean;

  /**
   * @internal
   */
  public [SUBS]: Set<Signal>;

  /**
   * @internal
   */
  public [EFFECT_CB]: () => void;

  constructor(effectCb: () => void, isActive = true) {
    this.isActive = isActive;
    this[EFFECT_CB] = effectCb;
    this[SUBS] = new Set();

    // run effect to subscribe all used signals
    this.exec();
  }

  public exec() {
    if (this.isActive) {
      const restoreEff = changeCurrentEffect(this);
      this[EFFECT_CB]();
      restoreEff();
    }
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
export function computed<T = any>(compute: () => T) {
  const internalSignal = signal<T>(undefined);

  // creating effect with isActive = false, 
  // so it won't call itself on start
  const eff = effect(() => {
    const restoreEffect = changeCurrentEffect(eff);

    // deleting old signals
    eff[SUBS].forEach(subSignal => {
      subSignal[DEPS].delete(eff);
      eff[SUBS].delete(subSignal);
    });

    // computing new signal value
    const newValue = compute();
    
    if (newValue !== internalSignal[VALUE]) {
      // the value is actually changed
      internalSignal.value = newValue;
    }

    // clean state
    restoreEffect();
  }, false);

  // computing the initial value & subscribe signals to the effect
  const restoreEffect = changeCurrentEffect(eff)
  internalSignal[VALUE] = compute();

  // restore
  restoreEffect();
  eff.isActive = true;

  return internalSignal;
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

    // batch completed, run all deps
    batchDeps.forEach(eff => {
      eff.exec();
    });

    // reset global state
    batchDeps.clear();
    isInBatch = false;
  }
}

/**
 * @description Changes signal to new, returns restore function
 * @param newEffect 
 */
function changeCurrentEffect(newEffect: Effect) {
  let prevSignal = currentEffect;
  currentEffect = newEffect;

  return () => {
    currentEffect = prevSignal
  };
}

/**
 * @description Effect constructor function, callback will be called every time deps change
 * @param cb Function that executes on dependencies change & right on start
 * @param isActive If true callback will be called on start
 * @example
 * const a = signal('a');
 * const eff = effect(() => console.log(a.value)); // a
 * a.value = 'aa'; // aa
 * 
 * eff.isActive = false;
 * a.value = 'a3'; // prints nothing
 */
export function effect(cb: () => void, isActive?: boolean) {
  return new Effect(cb, isActive);
}

/**
 * @description Signal constructor function
 * @example
 * const a = signal('a');
 * console.log(a.value) // a
 * 
 * a.value = 'aa'; 
 * console.log(a.value) // aa
 */
export function signal<T>(value?: T) {
  return new Signal(value);
}