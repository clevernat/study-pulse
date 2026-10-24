// Same palette as the website (tailwind.config.ts, "Linear" theme).
export const colors = {
  bg: "#08090a",
  card: "#0d0e11",
  raised: "#16171b",
  raisedHigh: "#1d1e22",
  border: "#292b30",
  text: "#eeeef0",
  textMuted: "#a7aab7",
  outline: "#838690",
  primary: "#a7b2f7",
  primaryStrong: "#5e6ad2",
  onPrimaryStrong: "#f6f8ff",
  green: "#5ed8a9",
  amber: "#ffb95f",
  error: "#ffb4ab",
} as const;

/** Background tint for a text color (e.g. chips): same hue, low opacity. */
export const tint = (hex: string, alpha = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
