import { freezeSet } from './freezeSet';

describe('Freeze set', () => {
  it('Prohibits to modify methods', () => {
    const set = freezeSet(new Set([1, 2, 3]));

    const tg = () => {
      // @ts-ignore
      set.add = () => {};
      // @ts-ignore
      set.clear = () => {};
      // @ts-ignore
      set.delete = () => {};
    };

    expect(tg).toThrow();
  });

  it('Not modifies the original state with mutation methods', () => {
    const origValue = [1, 2, 3];
    const set = freezeSet(new Set(origValue));
    const casted = set as unknown as Set<number>;

    casted.add(4);
    casted.delete(1);
    casted.clear();

    expect(Array.from(set)).toEqual(origValue);
  });
});
