/**
 * Pick a readable foreground for a merchant-defined primary colour.
 * Accepts hex or rgb()/rgba() values; unknown formats fall back to white.
 */
export function readableOnPrimary(color: string): string {
  const value = color.trim();
  let rgb: [number, number, number] | null = null;
  const hex = value.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    rgb = [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    rgb = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  } else {
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((channel) => channel / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.62 ? "#0b1f19" : "#ffffff";
}
