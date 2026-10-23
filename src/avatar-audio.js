// Simli consumes mono signed PCM16 little-endian at 16 kHz.
// Carry partial windows across chunks so resampling never drifts at boundaries.
export class AvatarAudio {
  constructor(rate = 16000) { this.setFormat(`pcm_${rate}`); }
  setFormat(format) {
    const match = /^pcm_(\d+)$/.exec(format || '');
    if (!match || Number(match[1]) < 16000) throw new Error('Unsupported avatar audio format');
    this.ratio = Number(match[1]) / 16000;
    this.remaining = this.ratio;
    this.sum = 0;
  }
  convert(base64) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.length % 2) throw new Error('Invalid PCM16 frame');
    const view = new DataView(bytes.buffer);
    const samples = [];
    for (let i = 0; i < bytes.length; i += 2) {
      const sample = view.getInt16(i, true);
      let available = 1;
      while (available > 1e-8) {
        const used = Math.min(available, this.remaining);
        this.sum += sample * used;
        this.remaining -= used;
        available -= used;
        if (this.remaining < 1e-8) {
          samples.push(Math.round(this.sum / this.ratio));
          this.sum = 0;
          this.remaining = this.ratio;
        }
      }
    }
    const result = new Uint8Array(samples.length * 2);
    const output = new DataView(result.buffer);
    samples.forEach((sample, i) => output.setInt16(i * 2, sample, true));
    return result;
  }
}
