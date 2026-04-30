export interface Nationality {
  /** ISO 3166-1 alpha-2 (för flagga + lagring) */
  code: string;
  label: string;
  /** Internationell förkortning på registreringsskylten (Oval/Euro-platta) */
  plate: string;
}

export const NATIONALITIES: Nationality[] = [
  { code: "SE", label: "Sverige", plate: "S" },
  { code: "NO", label: "Norge", plate: "N" },
  { code: "DK", label: "Danmark", plate: "DK" },
  { code: "FI", label: "Finland", plate: "FIN" },
  { code: "DE", label: "Tyskland", plate: "D" },
  { code: "NL", label: "Nederländerna", plate: "NL" },
  { code: "BE", label: "Belgien", plate: "B" },
  { code: "AT", label: "Österrike", plate: "A" },
  { code: "CH", label: "Schweiz", plate: "CH" },
  { code: "FR", label: "Frankrike", plate: "F" },
  { code: "GB", label: "Storbritannien", plate: "GB" },
];

const BY_CODE = new Map(NATIONALITIES.map((n) => [n.code, n]));

export const getNationality = (code?: string | null): Nationality | null => {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
};

export const flagUrl = (code: string) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
