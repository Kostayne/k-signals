type FreezedSet<T = unknown> = Omit<Set<T>, 'add' | 'delete' | 'clear'> & {
  add: () => void;
  clear: () => void;
  delete: () => void;
};

/**
 * @description returns a freezed copy of set
 */
export function freezeSet<T = unknown>(set: Set<T>): Readonly<FreezedSet<T>> {
  const freezed = new Set(set) as unknown as FreezedSet<T>;

  freezed.add = () => {};
  freezed.delete = () => {};
  freezed.clear = () => {};

  Object.freeze(freezed);
  return freezed;
}
