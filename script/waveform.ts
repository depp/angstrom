import Vue from "vue";

import { Clip } from "./audio";
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
  console.log("Y", y);
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
    let n = data.length * scale | 0;
    let w = new Float32Array(n)
    let j = 0;
    for (let i = 0; i < n; i++) {
      let j1 = Math.min(n, (i + 1) * scale);
      let m = j1 - j;
      let acc = 0;
      for (; j < j1; j++) {
        acc += data[j];
      }
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
    let n = data.length * scale | 0;
    let w0 = new Float32Array(n);
    let w1 = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      let j1 = Math.min(n, (i + 1) * scale);
      let p = data[j], p0 = p, p1 = p;
      for (j++; j < j1; j++) {
        p = data[j];
        p0 = Math.min(p0, p);
        p1 = Math.max(p1, p);
      }
      w0[i] = p0;
      w1[i] = p1;
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
    let x0 = pos * scale | 0, x1 = x0 + width;
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
/*
Vue.component("waveform", {
  props: [
    "url",
    "width",
    "bins",
    "length",
    "waveHeight",
  ],
  computed: {
    spectrumHeight(): number {
      return ((this.bins / 2) | 0) + 1;
    },
    spectrogram(): string {
      return (this.url + "/spectrogram?bins=" + this.bins + "&step=" +
              Math.round(this.length / this.width));
    },
    wsize(): number {
      return this.width * this.zoom * this.width / this.length;
    },
    x0(): number {
      return this.w0 * this.width / this.length;
    },
  },
  data: () => ({
    zoom: 16,
    w0: 0,
    waveX: 0,
    clip: <Clip|null> null,
    wave: <WaveformView|null> null,
    playing: false,
    playhead: 0,
  }),
  created() {
    fetch(this.url + "/data")
      .then((r: Response) => r.arrayBuffer())
      .then((arr: ArrayBuffer) => {
        let a = new Float32Array(arr);
        this.clip = new Clip(a);
        this.wave = new WaveformView(a,
                                     <SVGElement> this.$refs.wave,
                                     this.waveHeight);
        this.updateWave();
        this.clip.onupdated = (c: Clip) => {
          this.playing = c.isplaying;
        };
        console.log(this);
      });
  },
  watch: {
    w0() { this.updateWave(); },
    zoom() { this.updateWave(); },
  },
  template: "#waveform-template",
  methods: {
    startDrag(e: PointerEvent): void {
      let curW0 = this.w0;
      let scale = this.length / this.width;
      drag(
        this.$el, e,
        (x: number, y: number): void => this.setWindow(curW0 + scale * x),
        () => {},
      );
      console.log(this);
    },
    updateWave() {
      if (this.wave !== null) {
        let x0 = (this.w0 / this.zoom) | 0;
        this.waveX = this.wave.update(x0, x0 + this.width, this.zoom);
      }
    },
    playPause() {
      let clip = this.clip;
      if (clip === null) {
        return;
      };
      if (clip.isplaying) {
        clip.pause();
      } else {
        clip.play();
      }
    },
    stop() {
      let clip = this.clip;
      if (clip === null) {
        return;
      }
      clip.stop();
    },
    setWindow(w0: number) {
      let wmax = this.length - this.width * this.zoom;
      if (wmax < 0) {
        wmax = 0;
      }
      w0 = w0 | 0;
      if (w0 < 0) {
        w0 = 0;
      } else if (w0 > wmax) {
        w0 = wmax;
      }
      this.w0 = w0;
    },
    zoomIn() {
      let z = this.zoom * 0.5;
      if (z < 1) {
        return;
      }
      let w0 = this.w0 + 0.5 * z * this.width;
      this.zoom = z;
      this.setWindow(w0);
    },
    zoomOut() {
      let z = this.zoom * 2;
      if (z * this.width > this.length || z > 128) {
        return;
      }
      let w0 = this.w0 - 0.5 * this.zoom * this.width;
      this.zoom = z;
      this.setWindow(w0);
    },
  },
});
*/
