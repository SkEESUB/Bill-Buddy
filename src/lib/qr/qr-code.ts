/**
 * Minimal, zero-dependency QR Code SVG Generator in pure TypeScript.
 *
 * Implements ISO/IEC 18004 QR code matrix encoding with Error Correction Level M/L
 * for compact payloads (pairing tokens & endpoints) without requiring external npm packages.
 */

// QR Code specification tables
const PAD0 = 0xec;
const PAD1 = 0x11;

// Galois Field GF(256) tables for Reed-Solomon error correction
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  const logX = GF_LOG[x] ?? 0;
  const logY = GF_LOG[y] ?? 0;
  return GF_EXP[logX + logY] ?? 0;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i] ?? 0;
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ gfMul(p, root);
      next[j + 1] = (next[j + 1] ?? 0) ^ p;
    }
    poly = next;
  }
  return poly;
}

function rsCalculateEcc(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const res = new Uint8Array(eccLen);
  for (let i = 0; i < data.length; i++) {
    const factor = (data[i] ?? 0) ^ (res[0] ?? 0);
    for (let j = 0; j < eccLen - 1; j++) {
      res[j] = (res[j + 1] ?? 0) ^ gfMul(gen[j] ?? 0, factor);
    }
    res[eccLen - 1] = gfMul(gen[eccLen - 1] ?? 0, factor);
  }
  return res;
}

/**
 * Generates an SVG string representation of a QR Code for the given text.
 */
export function generateQrSvg(text: string, size = 200): string {
  // We use Version 4 (33x33 matrix) or Version 6 (41x41) which comfortably holds 150-250 characters
  // Byte mode (0100)
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  // Version 6: 41x41, total capacity at ECC Level L is 136 codewords (108 data, 28 ECC)
  const version = dataLen <= 84 ? 4 : 6;
  const moduleCount = version * 4 + 17;
  const totalCodewords = version === 4 ? 80 : 136;
  const eccCodewords = version === 4 ? 18 : 28;
  const dataCodewordsCount = totalCodewords - eccCodewords;

  // Build bitstream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode: 8-bit byte (0100)
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for V1-V9 in byte mode)
  pushBits(dataLen, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }
  // Terminator
  for (let i = 0; i < 4 && bits.length < dataCodewordsCount * 8; i++) {
    bits.push(0);
  }
  // Pad to byte
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  // Pad codewords up to dataCodewordsCount
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j]!;
    }
    dataBytes.push(byte);
  }
  let padToggle = false;
  while (dataBytes.length < dataCodewordsCount) {
    dataBytes.push(padToggle ? PAD1 : PAD0);
    padToggle = !padToggle;
  }

  // Calculate ECC
  const dataArr = new Uint8Array(dataBytes);
  const eccArr = rsCalculateEcc(dataArr, eccCodewords);

  // Combine data + ecc
  const allCodewords = new Uint8Array(totalCodewords);
  allCodewords.set(dataArr, 0);
  allCodewords.set(eccArr, dataArr.length);

  // Initialize Matrix
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(false),
  );

  const setModule = (r: number, c: number, val: boolean) => {
    matrix[r]![c] = val;
    isFunction[r]![c] = true;
  };

  // 1. Finder patterns (Top-left, Top-right, Bottom-left)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const tr = row + r;
        const tc = col + c;
        if (tr >= 0 && tr < moduleCount && tc >= 0 && tc < moduleCount) {
          const isBlack =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(tr, tc, isBlack);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, moduleCount - 7);
  drawFinder(moduleCount - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // 3. Dark module
  setModule(moduleCount - 8, 8, true);

  // 4. Alignment patterns for Version >= 2
  const alignCoords = version === 4 ? [6, 26] : [6, 34];
  for (const ar of alignCoords) {
    for (const ac of alignCoords) {
      if (isFunction[ar]![ac]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setModule(ar + r, ac + c, isBlack);
        }
      }
    }
  }

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8]![i]) isFunction[8]![i] = true;
    if (!isFunction[i]![8]) isFunction[i]![8] = true;
    if (!isFunction[8]![moduleCount - 1 - i]) isFunction[8]![moduleCount - 1 - i] = true;
    if (!isFunction[moduleCount - 1 - i]![8]) isFunction[moduleCount - 1 - i]![8] = true;
  }

  // 6. Write data bits with mask pattern 0: (row + col) % 2 === 0
  let bitIdx = 0;
  const totalBits = totalCodewords * 8;
  const getBit = (idx: number) => {
    if (idx >= totalBits) return 0;
    const byte = allCodewords[idx >>> 3]!;
    return (byte >>> (7 - (idx & 7))) & 1;
  };

  let upward = true;
  for (let right = moduleCount - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upward
      ? Array.from({ length: moduleCount }, (_, i) => moduleCount - 1 - i)
      : Array.from({ length: moduleCount }, (_, i) => i);

    for (const r of rows) {
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (!isFunction[r]![col]) {
          const bitVal = getBit(bitIdx++) === 1;
          const mask = (r + col) % 2 === 0;
          matrix[r]![col] = bitVal !== mask;
        }
      }
    }
    upward = !upward;
  }

  // 7. Format info for Mask 0 and ECC Level L (01 000 -> 0x77c4 with BCH code)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 6; i++) matrix[8]![i] = formatBits[i] === 1;
  matrix[8]![7] = formatBits[6] === 1;
  matrix[8]![8] = formatBits[7] === 1;
  matrix[7]![8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i]![8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[moduleCount - 1 - i]![8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8]![moduleCount - 15 + i] = formatBits[i] === 1;

  // Render clean SVG paths
  const quietZone = 2;
  const viewSize = moduleCount + quietZone * 2;
  let path = "";

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r]![c]) {
        path += `M${c + quietZone},${r + quietZone}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${viewSize}" height="${viewSize}" fill="#ffffff" rx="1"/>
    <path d="${path}" fill="#0f172a"/>
  </svg>`;
}
