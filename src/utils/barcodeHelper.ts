/**
 * Code 128 Barcode Generator in Pure TypeScript
 * Generates clean SVG markup and Data URLs for Code 128 barcodes
 */

// Code 128 pattern table (107 patterns, 11 bits each, except stop pattern which is 13 bits)
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011', // 106 = STOP
];

const START_B = 104;
const STOP = 106;

/**
 * Generate Code 128B binary bar sequence for ASCII text
 */
export function generateCode128Binary(text: string): string {
  const clean = text.replace(/[^\x20-\x7E]/g, '');
  if (!clean) return '';

  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP);

  return codes.map((c) => CODE128_PATTERNS[c] || '').join('');
}

/**
 * Generate an SVG string representing the barcode
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    height?: number;
    barWidth?: number;
    displayValue?: boolean;
    label?: string;
  } = {}
): string {
  const { height = 70, barWidth = 2, displayValue = true, label } = options;
  const binary = generateCode128Binary(text);
  if (!binary) return '';

  const quietZone = 20;
  const totalWidth = binary.length * barWidth + quietZone * 2;
  const totalHeight = displayValue ? height + 24 : height;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        const x = quietZone + barStart * barWidth;
        const w = (i - barStart) * barWidth;
        rects += `<rect x="${x}" y="8" width="${w}" height="${height}" fill="#0f172a" />`;
        inBar = false;
      }
    }
  }

  if (inBar) {
    const x = quietZone + barStart * barWidth;
    const w = (binary.length - barStart) * barWidth;
    rects += `<rect x="${x}" y="8" width="${w}" height="${height}" fill="#0f172a" />`;
  }

  const textElement = displayValue
    ? `<text x="${totalWidth / 2}" y="${height + 20}" font-family="monospace" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" letter-spacing="2">${
        label || text
      }</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${rects}
    ${textElement}
  </svg>`;
}

/**
 * Generate a base64 Data URL for the barcode SVG
 */
export function generateBarcodeDataUrl(text: string, options = {}): string {
  const svg = generateBarcodeSvg(text, options);
  if (!svg) return '';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
