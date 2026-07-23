// Logisk visningsordning för pass: morgon → dag → kväll → övrigt.
// Används för att alltid visa morgonpass före dagspass i medarbetarvyer,
// oavsett vilket shift_index passet råkar ha i databasen.
export const SHIFT_TYPE_ORDER: Record<string, number> = {
  morning: 0,
  day: 1,
  evening_a: 2,
  evening: 3,
  evening_b: 4,
  fishing: 5,
  clearing: 6,
  busy: 7,
  off: 8,
};

export function shiftTypeRank(type: string | null | undefined): number {
  if (!type) return 99;
  return SHIFT_TYPE_ORDER[type] ?? 50;
}

export function sortShiftsByType<T extends { shift_type?: string | null; shift_index?: number | null }>(
  shifts: T[],
): T[] {
  return [...shifts].sort((a, b) => {
    const ra = shiftTypeRank(a.shift_type);
    const rb = shiftTypeRank(b.shift_type);
    if (ra !== rb) return ra - rb;
    return (a.shift_index ?? 0) - (b.shift_index ?? 0);
  });
}
