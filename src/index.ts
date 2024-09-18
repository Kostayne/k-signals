import { freezeSet } from './utils/freezeSet';

let isInBatch = false;
let currentEffect: EffectImpl | undefined = undefined;

const batchDeps: Set<EffectImpl> = new Set();

const VALUE = Symbol.for('sig-value');
const DEPS = Symbol.for('sig-deps');
const SUBS = Symbol.for('sig-subs');
const EFFECT_CB = Symbol.for('eff-cb');
const IS_WATCHER = Symbol.for('eff-is-watcher');

const maxRecursionLevel = 100;
let recursionLevel = 0;

export class RecursionError extends Error {
  constructor(deepLevel: number) {
    super(
      `Max effect reactions count reached (${deepLevel}). It seems you have infinite recursion.`,
    );
  }
}

export interface Signal<T = unknown> extends SignalImpl<T> {}

export interface Effect extends EffectImpl {}

export interface ReadonlySignal<T = unknown> extends Signal<T> {
  readonly value: T;
}

class SignalImpl<T = unknown> implements Signal<T> {
  [VALUE]: T;
  [DEPS] = new Set<EffectImpl>();

  constructor(value?: T) {
    this[VALUE] = value as T;
  }

  public get value() {
    // subscribe to compute effect
    if (currentEffect !== undefined && !currentEffect[IS_WATCHER]) {
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
      deps.forEach((effect) => {
        batchDeps.add(effect);
      });
    } else {
      // update all dependencies
      deps.forEach((effect) => {
        effect.exec();
      });
    }
  }

  /**
   * @description get signals value without subscribing to it
   */
  public peek(): T {
    return this[VALUE];
  }
}

class EffectImpl implements Effect {
  public isActive: boolean;
  public onDispose?: () => void;

  /**
   * @internal
   */
  public [SUBS]: Set<SignalImpl>;

  /**
   * @internal
   */
  public [EFFECT_CB]: () => void;

  /**
   * @internal
   */
  public [IS_WATCHER] = false;

  constructor(effectCb: () => void, onDispose?: () => void, isActive = true) {
    this.isActive = isActive;
    this.onDispose = onDispose;
    this[EFFECT_CB] = effectCb;
    this[SUBS] = new Set();

    // run effect to subscribe all used signals
    this.exec();
  }

  public exec() {
    if (recursionLevel >= maxRecursionLevel) {
      const prevRec = recursionLevel;
      recursionLevel = 0;

      throw new RecursionError(prevRec);
    }

    if (this.isActive) {
      const restoreEff = changeCurrentEffect(this);
      recursionLevel++;

      try {
        this[EFFECT_CB]();
      } catch (e) {
        console.error('Caught exception in the effect, check your code..');
        throw e;
      } finally {
        recursionLevel--;
        restoreEff();
      }
    }
  }

  public dispose() {
    this[SUBS].forEach((signal) => {
      signal[DEPS].delete(this);
      this[SUBS].delete(signal);
    });

    this.onDispose?.();
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
export function computed<T = unknown>(compute: () => T): ReadonlySignal<T> {
  const internalSignal = signal<T>(undefined);

  // creating effect with isActive = false,
  // so it won't call itself on start
  const eff = new EffectImpl(
    () => {
      const restoreEffect = changeCurrentEffect(eff);

      // deleting old signals
      eff[SUBS].forEach((subSignal) => {
        subSignal[DEPS].delete(eff);
        eff[SUBS].delete(subSignal);
      });

      try {
        // computing new signal value
        const newValue = compute();

        // the value is actually changed
        if (newValue !== internalSignal[VALUE]) {
          internalSignal.value = newValue;
        }
      } catch (e) {
        console.error('Error in the compute function!');
      } finally {
        // clean global state
        restoreEffect();
      }
    },
    undefined,
    false,
  );

  const restoreEffect = changeCurrentEffect(eff);

  // computing the initial value & subscribe signals to the effect
  try {
    internalSignal[VALUE] = compute();
  } catch (e) {
    console.error('Error in the compute function!');
    throw e;
  } finally {
    // restore
    restoreEffect();
  }

  eff.isActive = true;
  return internalSignal as ReadonlySignal<T>;
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
    batchDeps.forEach((eff) => {
      eff.exec();
    });

    // reset global state
    batchDeps.clear();
    isInBatch = false;
  }
}

/**
 * @description Runs callback if specified deps changed
 * @param effectCb callback to run
 * @param deps deps to watch
 * @returns effect instance
 *
 * @example
 * const a = signal('a');
 * const b = signal('b');
 * const eff = watch(() => { console.log(a.value); console.log(b.value) }, [a]);
 *
 * a.value = 'aa'; // prints 'aa', 'b'
 * b.value = 'bb'; // prints nothing
 *
 * eff.dispose();
 */
export function watch(effectCb: () => void, deps: Signal[]) {
  // creating disabled effect
  const eff = effect(effectCb, undefined, false);
  eff[IS_WATCHER] = true;

  // freeze deps to ensure deps wont change
  const freezedDeps = freezeSet(new Set(deps));
  eff[SUBS] = freezedDeps as unknown as Set<SignalImpl>;

  // subscribe all deps
  freezedDeps.forEach((depSignal) => {
    depSignal[DEPS].add(eff);
    eff[SUBS].add(depSignal);
  });

  // activating the effect
  eff.isActive = true;
  return eff;
}

/**
 * @description Changes signal to new, returns restore function
 * @param newEffect
 */
function changeCurrentEffect(newEffect: EffectImpl) {
  const prevSignal = currentEffect;
  currentEffect = newEffect;

  return () => {
    currentEffect = prevSignal;
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
export function effect(
  cb: () => void,
  onDispose?: () => void,
  isActive?: boolean,
): Effect {
  return new EffectImpl(cb, onDispose, isActive);
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
export function signal<T = unknown>(value?: T): Signal<T> {
  return new SignalImpl(value);
}
