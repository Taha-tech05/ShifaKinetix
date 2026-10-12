// When does the camera move on its own? Only when the highlighted candidates changed since the last focus (and there are some).
export function planFocus(lastKey: string, ids: readonly string[] | undefined): { run: boolean; key: string } {
  const key = (ids ?? []).join('|');
  return { run: key !== '' && key !== lastKey, key };
}
