let ctx: AudioContext | null = null;
let clip: Clip | null = null;

export class Clip {
  private length: number;
  private buffer: AudioBuffer;
  private node: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private resumeTime: number = 0;
  private atEnd: boolean = false;
  onupdated: ((c: Clip) => void) | null = null;

  constructor(arr: Float32Array) {
    this.length = arr.length;
    this.buffer = new AudioBuffer({
      length: arr.length,
      sampleRate: 48000,
    })
    this.buffer.copyToChannel(arr, 0);
  }

  pause() {
    if (this.node === null) {
      return;
    }
    this.node.stop();
    if (ctx !== null)
      this.resumeTime = ctx.currentTime - this.startTime;
  }

  play() {
    if (clip !== null) {
      if (clip === this) {
        return;
      }
      clip.stop();
    }
    if (ctx === null) {
      ctx = new AudioContext;
    }
    this.node = ctx.createBufferSource();
    this.node.onended = () => {
      this.node = null;
      let f = this.onupdated;
      if (f)
        f(this);
    };
    this.node.buffer = this.buffer;
    this.node.connect(ctx.destination);
    this.startTime = ctx.currentTime - this.resumeTime;
    this.node.start(0, this.resumeTime);
    this.resumeTime = 0;
    let f = this.onupdated;
    if (f)
      f(this);
  }

  // stop stops playback and resets the playback position.
  stop() {
    this.resumeTime = 0;
    this.atEnd = false;
    if (this.node === null) {
      return;
    }
    this.node.stop();
    this.node = null;
    let f = this.onupdated;
    if (f)
      f(this);
  }

  // isplaying is true if this sound is currently playing.
  get isplaying(): boolean {
    return this.node !== null;
  }

  // position is the current playback position, in samples.
  get position(): number {
    let n: number;
    if (this.node !== null && ctx !== null) {
      n = ctx.currentTime - this.startTime;
    } else if (this.atEnd) {
      return this.length;
    } else {
      n = this.resumeTime;
    }
    n = (48000 * n) | 0;
    if (n > this.length) {
      n = this.length;
    }
    if (n < 0) {
      n = 0;
    }
    return n;
  }
}
