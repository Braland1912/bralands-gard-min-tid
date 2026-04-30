export interface Nationality {
  code: string;
  label: string;
}

export const NATIONALITIES: Nationality[] = [
  { code: "SE", label: "Sverige" },
  { code: "NO", label: "Norge" },
  { code: "DK", label: "Danmark" },
  { code: "FI", label: "Finland" },
  { code: "DE", label: "Tyskland" },
  { code: "NL", label: "Nederländerna" },
  { code: "BE", label: "Belgien" },
  { code: "AT", label: "Österrike" },
  { code: "CH", label: "Schweiz" },
  { code: "FR", label: "Frankrike" },
  { code: "GB", label: "Storbritannien" },
];

const BY_CODE = new Map(NATIONALITIES.map((n) => [n.code, n]));

export const getNationality = (code?: string | null): Nationality | null => {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
};

export const flagUrl = (code: string) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
