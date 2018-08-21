import Vue from "vue";
import VueRouter from "vue-router";

import { drag } from "./drag";

interface InputInfo {
  url: string;
  name: string;
}

const Inputs = Vue.extend({
  data() {
    return {
      loading: false,
      items: <InputInfo[]|null>null,
      error: <Error|null>null,
    };
  },
  created() {
    this.fetchData();
  },
  template: "#inputlist-template",
  methods: {
    fetchData() {
      this.loading = true;
      this.items = null;
      this.error = null;
      fetch("/input")
        .then((r: Response) => r.json())
        .then((items: InputInfo[]) => {
          this.loading = false;
          this.items = items;
        })
        .catch((e: Error) => {
          this.loading = false;
          this.error = e;
        });
    },
  },
});

interface InputData extends InputInfo {
  length: number;
}

const Input = Vue.extend({
  data() {
    return {
      loading: false,
      item: <InputData|null>null,
      error: <Error|null>null,
    };
  },
  created() {
    this.fetchData();
  },
  template: "#input-template",
  methods: {
    fetchData() {
      this.loading = true;
      this.item = null;
      this.error = null;
      fetch("/input/" + this.$route.params.inputId)
        .then((r: Response) => r.json())
        .then((item: InputData) => {
          this.loading = false;
          this.item = item;
        })
        .catch((e: Error) => {
          this.loading = false;
          this.error = e;
        });
    },
  },
});

const router = new VueRouter({
  routes: [
    { path: "/input", component: Inputs },
    { path: "/input/:inputId", component: Input },
  ],
});

const app = new Vue({
  router,
}).$mount("#app");

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
    let arr = this.w.subarray(x0, x1);
    let p = arrayToPath(arr, h, false, "M", "L");
    let path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", p);
    path.setAttribute("class", "wave-simple");
    elt.appendChild(path);
  }
}

/*
class Waveform {
  constructor(data: Float32Array, zoom: number) {
    let n = (data.length / zoom) | 0;
    let w0 = new Float32Array(n);
    let w1 = new Float32Array(n);
    let w2 = new Float32Array(n);
    let w3 = new Float32Array(n);
    let scale = 1/zoom;
    for (let i = 0; i < n; i++) {
      let p = data[i * zoom];
      let pmin = p, pmax = p, pavg = p;
      for (let j = 1; j < zoom; j++) {
        p = data[i * zoom + j];
        pmin = Math.min(pmin, p);
        pmax = Math.min(pmax, p);
        pavg += p;
      }
      pavg *= scale;
      let pvar = 0;
      for (let j = 0; j < zoom; j++) {
        p = data[i * zoom + j];
        pvar += (p - pavg) * (p - pavg);
      }
      pvar = Math.sqrt(pvar * scale);
      w0[i] = pmin;
      w1[i] = pavg - pvar;
      w2[i] = pavg + pvar;
      w3[i] = pmax;
    }
  }
  createSVG(x0: number, x1: number): SVGGElement {
    let n = x1 - x0;
  }
}
*/

class WaveformView {
  private idx0: number = 0;
  private idx1: number = 0;
  private x0: number = 0;
  private zoom: number = 0;
  private data: Float32Array;
  private parent: SVGElement;
  private height: number;
  private wave: SimpleWaveform | null = null;
  constructor(data: Float32Array, parent: SVGElement, height: number) {
    this.data = data;
    this.parent = parent
    this.height = height;
  }
  update(w0: number, w1: number, zoom: number): number {
    const margin = 16;
    if (this.zoom !== this.zoom ||
        (this.idx0 != -1 && this.idx0 + margin >= w0) ||
        (this.idx1 != -1 && this.idx1 - margin <= w1)) {
      this.rebuild((w0 + 0.5 * (w1 - w0)) | 0, zoom);
    }
    return this.x0 - w0;
  }
  private rebuild(center: number, zoom: number) {
    if (this.wave === null || this.zoom !== zoom) {
      this.wave = new SimpleWaveform(this.data, zoom);
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
    wave: <WaveformView|null> null,
  }),
  created() {
    fetch(this.url + "/data")
      .then((r: Response) => r.arrayBuffer())
      .then((arr: ArrayBuffer) => {
        this.wave = new WaveformView(new Float32Array(arr),
                                     <SVGElement> this.$refs.wave,
                                     this.waveHeight);
        this.updateWave();
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
      let wmin = 0, wmax = this.length - this.width * this.zoom;
      if (wmax < 0) {
        wmax = 0;
      }
      let scale = this.length / this.width;
      drag(
        this.$el, e,
        (x: number, y: number): void => {
          let w0 = curW0 + scale * x;
          if (w0 < wmin) {
            w0 = wmin;
          } else if (w0 > wmax) {
            w0 = wmax;
          }
          this.w0 = w0;
        },
        () => {},
      );
    },
    updateWave() {
      if (this.wave !== null) {
        let x0 = (this.w0 / this.zoom) | 0;
        this.waveX = this.wave.update(x0, x0 + this.width, this.zoom);
      }
    },
  },
});
