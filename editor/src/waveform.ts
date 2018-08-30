import Vue from "vue";

import { AudioClip } from "./audio";
import { drag } from "./drag";

interface Waveform {
  createSVG(elt: SVGElement, x0: number, x1: number, h: number): void;
  length: number;
}

function arrayToPath(arr: Float32Array, height: number,
                     reverse: boolean, c1: string, c2: string): string {
  let p = "";
  let c = c1;
  let y = height * 0.5 | 0;
  if (reverse) {
    for (let x = arr.length - 1; x >= 0; x--) {
      p += c;
      p += " ";
      p += x;
      p += " ";
      p += (arr[x] * y + y) | 0;
      p += " ";
      c = c2;
    }
  } else {
    for (let x = 0; x < arr.length; x++) {
      p += c;
      p += " ";
      p += x;
      p += " ";
      p += (arr[x] * y + y) | 0;
      p += " ";
      c = c2;
    }
  }
  return p;
}

const SVGNS = "http://www.w3.org/2000/svg";

class SimpleWaveform {
  private w: Float32Array;
  constructor(data: Float32Array, scale: number) {
    let nn = data.length;
    let n = nn / scale | 0;
    let w = new Float32Array(n)
    let sidx = 0;
    for (let pidx = 0; pidx < n; pidx++) {
      let starget = Math.min(nn, (pidx + 1) * scale | 0);
      let scount = starget - sidx;
      let acc = 0;
      for (; sidx < starget; sidx++) {
        acc += data[sidx];
      }
      w[pidx] = acc / scount;
    }
    this.w = w;
  }
  createSVG(elt: SVGElement, x0: number, x1: number, h: number): void {
    let p = arrayToPath(this.w.subarray(x0, x1), h, false, "M", "L");
    let path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", p);
    path.setAttribute("class", "wave-line");
    elt.appendChild(path);
  }
  get length(): number { return this.w.length; }
}

class DoubleWaveform {
  private w0: Float32Array;
  private w1: Float32Array;
  constructor(data: Float32Array, scale: number) {
    let nn = data.length;
    let n = nn / scale | 0;
    let w0 = new Float32Array(n);
    let w1 = new Float32Array(n);
    let sidx = 0;
    for (let pidx = 0; pidx < n; pidx++) {
      let starget = Math.min(nn, (pidx + 1) * scale | 0)
      let s = data[sidx], p0 = s, p1 = s;
      for (sidx++; sidx < starget; sidx++) {
        s = data[sidx];
        p0 = Math.min(p0, s);
        p1 = Math.max(p1, s);
      }
      w0[pidx] = p0;
      w1[pidx] = p1;
    }
    this.w0 = w0;
    this.w1 = w1;
  }
  createSVG(elt: SVGElement, x0: number, x1: number, h: number): void {
    let p = arrayToPath(this.w0.subarray(x0, x1), h, false, "M", "L");
    p += arrayToPath(this.w1.subarray(x0, x1), h, true, "L", "L");
    p += "Z";
    let path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", p)
    path.setAttribute("class", "wave-full")
    elt.appendChild(path);
  }
  get length(): number { return this.w0.length; }
}

class WaveformView {
  private readonly data: Float32Array;
  private readonly parent: SVGElement;

  // Range of pixels present in the waveform view.
  private x0: number = 0;
  private x1: number = 0;

  // Scale and height of the waveform.
  private scale: number = 0;
  private height: number = 0;

  // The wave data, rescaled to have one sample per pixel.
  private wave: Waveform|null = null;

  constructor(data: Float32Array, parent: SVGElement) {
    this.data = data;
    this.parent = parent;
  }

  // Update the SVG waveform.
  // width - viewport width in pixels
  // height - viewport height in pixels
  // pos - sample position of viewport left edge
  // scale - samples per pixel
  update(width: number, height: number, pos: number, scale: number) {
    let wave = this.wave;
    if (!wave || this.scale !== scale || this.height !== height) {
      if (scale <= 2) {
        wave = new SimpleWaveform(this.data, scale);
      } else {
        wave = new DoubleWaveform(this.data, scale);
      }
      this.x0 = 0;
      this.x1 = 0;
      this.wave = wave;
    }
    let x0 = pos / scale | 0, x1 = x0 + width;
    let n = wave.length;
    const margin = 16;
    if ((this.x0 !== 0 && this.x0 > x0) ||
        (this.x1 !== n && this.x1 < x1)) {
      let w = 512;
      while (w < width) {
        w *= 2;
      }
      let c = (x0 + (x1 - x0) * 0.5) | 0;
      let w0 = c - w, w1 = c + w;
      if (w0 < 0) {
        w0 = 0;
        w1 = Math.min(w * 2, n);
      } else if (w1 > n) {
        w0 = Math.max(0, n - w * 2);
        w1 = n;
      }
      let elt = this.parent;
      while (elt.firstChild) {
        elt.removeChild(elt.firstChild);
      }
      wave.createSVG(elt, w0, w1, height);
      this.x0 = w0;
      this.x1 = w1;
    }
    this.parent.setAttribute(
      "transform", "translate(" + (this.x0 - x0) + " 0)");
  }
}

Vue.component("audio-wave", {
  props: [
    "data",
    "width",
    "height",
    "pos",
    "scale",
  ],
  template: "#audio-wave-template",
  data: () => ({
    wave: null as WaveformView|null,
  }),
  mounted() {
    this.updateWave();
  },
  watch: {
    data() { this.wave = null; this.updateWave(); },
    width() { this.updateWave(); },
    height() { this.updateWave(); },
    pos() { this.updateWave(); },
    scale() { this.updateWave(); },
  },
  methods: {
    updateWave() {
      if (this.data === null) {
        this.wave = null;
        let elt = this.$refs.wave as Element;
        while (elt.firstChild) {
          elt.removeChild(elt.firstChild);
        }
        return;
      }
      if (this.wave === null) {
        this.wave = new WaveformView(this.data, this.$refs.wave as SVGElement);
      }
      this.wave.update(this.width, this.height, this.pos, this.scale);
    },
  },
});

Vue.component("audio-nav", {
  props: {
    url: {type: String},
    data: {type: Float32Array},
    width: {type: Number},
    height: {type: Number},
    pos: {type: Number},
    scale: {type: Number},
  },
  template: "#audio-nav-template",
  computed: {
    navScale(): number {
      if (!this.data)
        return 1;
      return this.data.length / this.width;
    },
    spectrogram(): string {
      return (this.url + "/spectrogram?bins=" + 128 + "&step=" +
              Math.round(this.navScale));
    },
  },
  methods: {
    clickSelection(e: PointerEvent) {
      let pos0 = this.pos;
      let fac = this.data.length / this.width;
      drag(
        this.$el, e,
        (x: number, y: number): void => {
          this.$emit("update:pos", pos0 + fac * x);
        },
        () => {},
      );
    },
    setPos(pos: number) {
    },
  },
});
