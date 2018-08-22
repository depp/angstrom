import Vue from "vue";

import { Clip } from "./audio";
import { drag } from "./drag";

interface Waveform {
  createSVG(elt: SVGElement, x0: number, x1: number, h: number): void;
}

function arrayToPath(arr: Float32Array, height: number,
                     reverse: boolean, c1: string, c2: string): string {
  let p = "";
  let c = c1;
  if (reverse) {
    for (let x = arr.length - 1; x >= 0; x--) {
      p += c;
      p += " ";
      p += x;
      p += " ";
      p += Math.round(arr[x] * height);
      p += " ";
      c = c2;
    }
  } else {
    for (let x = 0; x < arr.length; x++) {
      p += c;
      p += " ";
      p += x;
      p += " ";
      p += Math.round(arr[x] * height);
      p += " ";
      c = c2;
    }
  }
  return p;
}

const SVGNS = "http://www.w3.org/2000/svg";

class SimpleWaveform {
  private w: Float32Array;
  constructor(data: Float32Array, zoom: number) {
    let n = (data.length / zoom) | 0;
    let w = new Float32Array(n)
    let scale = 1 / zoom;
    for (let i = 0; i < n; i++) {
      let pavg = 0;
      for (let j = 0; j < zoom; j++) {
        pavg += data[i * zoom + j];
      }
      pavg *= scale;
      w[i] = pavg;
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
}

class DoubleWaveform {
  private w0: Float32Array;
  private w1: Float32Array;
  constructor(data: Float32Array, zoom: number) {
    let n = (data.length / zoom) | 0;
    let w0 = new Float32Array(n);
    let w1 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let p = data[i * zoom];
      let p0 = p, p1 = p;
      for (let j = 1; j < zoom; j++) {
        p = data[i * zoom + j];
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
}

class QuadrupleWaveform {
  private w0: Float32Array;
  private w1: Float32Array;
  private w2: Float32Array;
  private w3: Float32Array;
  constructor(data: Float32Array, zoom: number) {
    let n = (data.length / zoom) | 0;
    let w0 = new Float32Array(n);
    let w1 = new Float32Array(n);
    let w2 = new Float32Array(n);
    let w3 = new Float32Array(n);
    let scale = 1 / zoom;
    for (let i = 0; i < n; i++) {
      let p = data[i * zoom];
      let p0 = p, p1 = p, pm = p, pv = 0;
      for (let j = 1; j < zoom; j++) {
        p = data[i * zoom + j];
        p0 = Math.min(p0, p);
        p1 = Math.max(p1, p);
        pm += p;
      }
      pm *= scale;
      for (let j = 0; j < zoom; j++) {
        p = data[i * zoom + j] - pm;
        pv += p * p;
      }
      pv = Math.sqrt(pv * scale);
      w0[i] = p0;
      w1[i] = pm - pv;
      w2[i] = pm + pv;
      w3[i] = p1;
    }
    this.w0 = w0;
    this.w1 = w1;
    this.w2 = w2;
    this.w3 = w3;
  }
  createSVG(elt: SVGElement, x0: number, x1: number, h: number): void {
    let p = arrayToPath(this.w0.subarray(x0, x1), h, false, "M", "L");
    p += arrayToPath(this.w3.subarray(x0, x1), h, true, "L", "L");
    p += "Z";
    let p2 = arrayToPath(this.w1.subarray(x0, x1), h, false, "M", "L");
    p2 += arrayToPath(this.w2.subarray(x0, x1), h, true, "L", "L");
    p2 += "Z";
    let path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", p)
    path.setAttribute("class", "wave-outer")
    let path2 = document.createElementNS(SVGNS, "path");
    path2.setAttribute("d", p2)
    path2.setAttribute("class", "wave-inner")
    elt.appendChild(path);
    elt.appendChild(path2);
  }
}

function makeWaveform(data: Float32Array, zoom: number): Waveform {
  if (zoom <= 2)
    return new SimpleWaveform(data, zoom);
  if (zoom <= 8 || true)
    return new DoubleWaveform(data, zoom);
  return new QuadrupleWaveform(data, zoom);
}

class WaveformView {
  private idx0: number = 0;
  private idx1: number = 0;
  private x0: number = 0;
  private zoom: number = 0;
  private data: Float32Array;
  private parent: SVGElement;
  private height: number;
  private wave: Waveform | null = null;
  constructor(data: Float32Array, parent: SVGElement, height: number) {
    this.data = data;
    this.parent = parent
    this.height = height;
  }
  update(w0: number, w1: number, zoom: number): number {
    const margin = 16;
    if (this.zoom !== zoom ||
        (this.idx0 != -1 && this.idx0 + margin >= w0) ||
        (this.idx1 != -1 && this.idx1 - margin <= w1)) {
      this.rebuild((w0 + 0.5 * (w1 - w0)) | 0, zoom);
    }
    return this.x0 - w0;
  }
  private rebuild(center: number, zoom: number) {
    if (this.wave === null || this.zoom !== zoom) {
      this.wave = makeWaveform(this.data, zoom);
      this.zoom = zoom;
    }
    const w = 1024;
    let n = (this.data.length / zoom) | 0;
    let i0 = center - w, i1 = center + w;
    if (i0 < 0) {
      i0 = 0;
      i1 = Math.min(w * 2, n);
    } else if (i1 > n) {
      i0 = Math.max(0, n - 2*w);
      i1 = n;
    }
    var elt = this.parent;
    while (elt.firstChild !== null) {
      elt.removeChild(elt.firstChild);
    }
    this.wave.createSVG(elt, i0, i1, (this.height * 0.5) | 0);
    this.idx0 = i0 == 0 ? -1 : i0;
    this.idx1 = i1 == n ? -1 : i1;
    this.x0 = i0;
  }
}

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
