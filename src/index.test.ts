import {
  batch,
  computed,
  effect,
  RecursionError,
  signal,
  watch,
} from './index';

describe('Signals', () => {
  it('Signal stores the value', () => {
    const a = signal(2);

    expect(a.value).toBe(2);

    a.value = 5;
    expect(a.value).toBe(5);
  });

  it('Computed returns correct value without deps change', () => {
    const a = signal(2);
    const tg = computed(() => a.value * 2);

    expect(tg.value).toBe(4);
  });

  it("Computed updates it's value on deps change", () => {
    const a = signal(2);

    const spy = jest.fn(() => a.value * 2);
    const tg = computed(spy);

    a.value = 5;

    expect(tg.value).toBe(10);
  });

  it('Computed called once if deps not changed', () => {
    const a = signal(2);

    const spy = jest.fn(() => a.value * 2);
    computed(spy);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Computed called twice if deps changed', () => {
    const a = signal(2);

    const spy = jest.fn(() => a.value * 2);
    computed(spy);

    a.value = 5;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Computed not runs callback if dep values are the same', () => {
    const a = signal(2);

    const spy = jest.fn(() => a.value * 2);
    computed(spy);

    a.value = 2;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Computed watching only needed deps', () => {
    const returnA = signal(true);

    const a = signal('a');
    const b = signal('b');

    const spy = jest.fn(() => (returnA.value ? a.value : b.value));
    computed(spy);

    b.value = 'b1';
    expect(spy).toHaveBeenCalledTimes(1);
    a.value = 'a1';
    expect(spy).toHaveBeenCalledTimes(2);

    returnA.value = false;
    expect(spy).toHaveBeenCalledTimes(3);

    a.value = 'a2';
    expect(spy).toHaveBeenCalledTimes(3);
    b.value = 'b2';
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('Computed can depend on computed', () => {
    const a = signal('a');
    const t1 = computed(() => a.value);
    const tg = computed(() => t1.value);

    expect(tg.value).toBe('a');

    a.value = 'aa';
    expect(tg.value).toBe('aa');
  });

  it("Computed can't cause an infinite loop with dep value reassign", () => {
    const a = signal('a');
    const comp = computed(() => {
      a.value = 'aa';
      return a.value;
    });

    expect(comp.value).toBe('aa');
  });

  it('Effect runs once if deps not changed', () => {
    const a = signal('a');
    const tg = jest.fn(() => a.value);
    const e = effect(tg);

    expect(tg).toHaveBeenCalledTimes(1);
  });

  it('Effect runs twice if deps changed', () => {
    const a = signal('a');
    const tg = jest.fn(() => a.value);
    effect(tg);

    a.value = 'aa';
    expect(tg).toHaveBeenCalledTimes(2);
  });

  it("Effect won't be called if it's deactivated", () => {
    const a = signal('a');
    const tg = jest.fn(() => a.value);
    const eff = effect(tg);
    eff.isActive = false;

    a.value = 'aa';
    expect(tg).toHaveBeenCalledTimes(1);
  });

  it("Effect won't be called after dispose", () => {
    const a = signal('a');
    const tg = jest.fn(() => a.value);
    const eff = effect(tg);
    eff.dispose();

    a.value = 'aa';
    expect(tg).toHaveBeenCalledTimes(1);
  });

  it('Effect onDispose called with dispose', () => {
    const tg = jest.fn(() => {});
    const eff = effect(() => {});

    eff.onDispose = tg;
    eff.dispose();

    expect(tg).toHaveBeenCalledTimes(1);
  });

  it("Effect won't cause infinite loop with computed", () => {
    const tg = () => {
      const a = signal(0);
      const comp = computed(() => a.value);

      const spy = jest.fn(() => {
        a.value = a.value + comp.value;
      });
      effect(spy);

      a.value++;
    };

    expect(tg).toThrow(RecursionError);
  });

  it('Effect not subscribe to signal if peek used', () => {
    const a = signal('a');
    const tg = jest.fn(() => a.peek());

    effect(tg);
    a.value = 'aa';

    expect(tg).toHaveBeenCalledTimes(1);
  });

  it('Batch postpones signal reactions', () => {
    const a = signal('a');
    const b = signal('b');

    const spy = jest.fn(() => a.value + b.value);
    const tg = computed(spy);

    batch(() => {
      a.value = 'aa';
      b.value = 'bb';
    });

    expect(tg.value).toBe('aabb');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Only the outer batch will update deps', () => {
    const a = signal('a');
    const b = signal('b');

    const spy = jest.fn(() => a.value + b.value);
    const tg = computed(spy);

    batch(() => {
      batch(() => {
        a.value = 'a1';
        b.value = 'b1';
      });

      a.value = 'aa';
      b.value = 'bb';
    });

    expect(tg.value).toBe('aabb');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Watcher not runs on start', () => {
    const a = signal('a');
    const tg = jest.fn(() => {});
    const eff = watch(tg, [a]);

    expect(tg).toHaveBeenCalledTimes(0);
  });

  it('Watcher runs only on deps change', () => {
    const a = signal('a');
    const tg = jest.fn(() => {});
    watch(tg, [a]);
    a.value = 'aa';

    expect(tg).toHaveBeenCalledTimes(1);
  });

  it('Watcher not runs on actual deps change if they are not listed explicitly', () => {
    const a = signal('a');
    const tg = jest.fn(() => {
      a.value;
    });
    watch(tg, []);
    a.value = 'aa';

    expect(tg).toHaveBeenCalledTimes(0);
  });
});
