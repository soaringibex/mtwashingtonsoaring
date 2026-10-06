// A small radix-2 complex FFT — no dependency, sized for the 3-D wave solve's
// 256×256 terrain grid. Both directions are UNNORMALIZED (the forward transform is
// H_k = Σ h_s e^{−2πi ks/N}, the inverse is Σ H_k e^{+2πi ks/N}), so callers apply
// their own 1/N² exactly where the physics calls for it.

/** In-place 1-D transform over a strided sequence: index `offset + i·stride`. */
export function fft1d(
  re: Float64Array,
  im: Float64Array,
  offset: number,
  stride: number,
  n: number,
  inverse: boolean,
): void {
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error("fft1d: length must be a power of two");

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      let swap = re[a];
      re[a] = re[b];
      re[b] = swap;
      swap = im[a];
      im[a] = im[b];
      im[b] = swap;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      let twRe = 1;
      let twIm = 0;
      for (let k = 0; k < half; k += 1) {
        const i0 = offset + (start + k) * stride;
        const i1 = offset + (start + k + half) * stride;
        const xRe = re[i1] * twRe - im[i1] * twIm;
        const xIm = re[i1] * twIm + im[i1] * twRe;
        re[i1] = re[i0] - xRe;
        im[i1] = im[i0] - xIm;
        re[i0] += xRe;
        im[i0] += xIm;
        const nextRe = twRe * wRe - twIm * wIm;
        twIm = twRe * wIm + twIm * wRe;
        twRe = nextRe;
      }
    }
  }
}

/** In-place 2-D transform of a `size × size` row-major grid: rows, then columns. */
export function fft2d(re: Float64Array, im: Float64Array, size: number, inverse = false): void {
  for (let row = 0; row < size; row += 1) {
    fft1d(re, im, row * size, 1, size, inverse);
  }
  for (let col = 0; col < size; col += 1) {
    fft1d(re, im, col, size, size, inverse);
  }
}
