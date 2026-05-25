const palettes = {
  dark: {
    bg: '#050508',
    surface: '#0a0a0f',
    surfaceSoft: '#12131d',
    text: '#c5c6cb',
    muted: '#8d909b',
    faint: '#787d8f',
    primary: '#4f5fdd',
    primaryText: '#f0f2ff',
  },
  light: {
    bg: '#f3eee6',
    surface: '#fbf7f0',
    surfaceSoft: '#eee5d8',
    text: '#28231f',
    muted: '#51483f',
    faint: '#675d52',
    primary: '#5664c2',
    primaryText: '#f8f4ed',
  },
};

const checks = [
  ['text on bg', 'text', 'bg', 7],
  ['text on surface', 'text', 'surface', 7],
  ['muted on surface', 'muted', 'surface', 4.5],
  ['faint on surface', 'faint', 'surface', 4.5],
  ['text on soft surface', 'text', 'surfaceSoft', 7],
  ['muted on soft surface', 'muted', 'surfaceSoft', 4.5],
  ['primary text on primary', 'primaryText', 'primary', 4.5],
];

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelToLinear(value) {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let failed = false;

for (const [themeName, palette] of Object.entries(palettes)) {
  for (const [label, fgKey, bgKey, min] of checks) {
    const ratio = contrast(palette[fgKey], palette[bgKey]);
    const formatted = ratio.toFixed(2);
    if (ratio < min) {
      failed = true;
      console.error(`${themeName}: ${label} contrast ${formatted}:1 is below ${min}:1`);
    } else {
      console.log(`${themeName}: ${label} contrast ${formatted}:1`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Theme contrast check passed.');
