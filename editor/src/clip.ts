import Vue from "vue";
import $ from "jquery";

import { AudioClip } from "./audio";

interface ClipInfo {
  name: string;
  title: string;
  length: number;
  file: string;
}

export const ClipList = Vue.extend({
  data() {
    return {
      loading: false,
      clips: null as ClipInfo[]|null,
      error: null as Error|null,
    };
  },
  created() {
    this.fetchData();
  },
  template: "#clip-list-template",
  methods: {
    fetchData() {
      this.loading = true;
      this.clips = null;
      this.error = null;
      fetch("/api/clip")
        .then((r: Response) => r.json())
        .then((clips: ClipInfo[]) => {
          this.loading = false;
          this.clips = clips;
        })
        .catch((e: Error) => {
          this.loading = false;
          this.error = e;
        });
    },
  },
});

const kZoomSteps = 2;
const kMinZoom = 0;
const kMaxZoom = 7 * kZoomSteps;

function zoomLevel(scale: number): number {
  return Math.round(Math.log2(scale) * kZoomSteps);
}

function zoomScale(level: number): number {
  return Math.pow(2, level/kZoomSteps);
}

const kWidth = 800;

type Bandwidth = "Auto" | "NB" | "MB" | "WB" | "SWB" | "FB";

interface EncoderConfig {
  bandwidth?: Bandwidth;
  bitrate?: number;
  independent?: boolean;
}

interface Packet extends EncoderConfig {
  length: number;
}

interface SliceInfo extends EncoderConfig {
  clip?: string;
  index?: number;
  class?: string;
  selected?: boolean;
  pos: number;
  packets: Packet[];
  comment?: string;
  length?: number;
}

interface SegmentInfo {
  source: string;
  pos: number;
  length: number;
}

Vue.component("clip-item-view", {
  props: [
    "items",
    "width",
    "pos",
    "scale",
    "selected",
  ],
  template: "#clip-item-template",
});

export const Clip = Vue.extend({
  data() {
    return {
      loading: false,
      error: null as Error|null,
      item: null as ClipInfo|null,
      data: null as Int16Array|null,
      clip: null as AudioClip|null,
      slices: [] as Slice[],
      selectedSlice: 0,
      segments: [] as Segment[],
      selectedSegment: 0,
      scale: 32,
      pos: 0,
      playing: false,
      playhead: 0,
      width: kWidth,
      decimateRatio: 1,
    };
  },
  created() {
    this.fetchData();
  },
  template: "#clip-template",
  computed: {
    url(): string {
      return "/api/clip/" + this.$route.params.clipID;
    },
  },
  methods: {
    fetchData() {
      this.loading = true;
      this.error = null;
      this.item = null;
      this.data = null;
      this.clip = null;
      let url = this.url;
      Promise.all([
        fetch(url)
          .then((r: Response) => {
            if (!r.ok)
              throw Error(r.statusText);
            return r.json()
          }),
        fetch(url + "/input/data")
          .then((r: Response) => {
            if (!r.ok)
              throw Error(r.statusText);
            return r.arrayBuffer();
          }),
      ]).then(([item, data]) => {
        this.loading = false;
        this.item = item;
        this.data = new Int16Array(data);
        this.clip = new AudioClip(this.data);
        let updatePlayhead = () => {
          let clip = this.clip;
          if (!clip || !clip.isplaying) {
            return;
          }
          this.playhead = clip.position;
          window.requestAnimationFrame(updatePlayhead);
        };
        this.clip.onupdated = (c: AudioClip) => {
          this.playing = c.isplaying;
          window.requestAnimationFrame(updatePlayhead);
        };
      }).catch((e: Error) => {
        console.error(e);
        this.loading = false;
        this.error = e;
      });
    },
    updatePos(pos: number) {
      if (!this.data)
        return;
      let pmax = (this.data.length - this.scale * 800) | 0;
      if (pos > pmax)
        pos = pmax;
      if (pos < 0)
        pos = 0;
      this.pos = pos;
    },
    zoomBy(n: number) {
      let scale0 = this.scale;
      let level0 = zoomLevel(scale0);
      let level1 = level0 + n;
      if (level1 < kMinZoom) {
        level1 = kMinZoom;
      } else if (level1 > kMaxZoom) {
        level1 = kMaxZoom;
      }
      if (level0 === level1)
        return;
      let scale1 = zoomScale(level1);
      let pos = this.pos;
      this.scale = scale1;
      this.updatePos(pos + (scale0 - scale1) * (0.5 * kWidth));
    },
    zoomIn() {
      this.zoomBy(-1);
    },
    zoomOut() {
      this.zoomBy(1);
    },
    stop() {
      let c = this.clip;
      if (!c)
        return;
      c.stop();
    },
    playPause() {
      let c = this.clip;
      if (!c)
        return;
      if (c.isplaying) {
        c.pause();
      } else {
        c.play();
      }
    },
    decimateShow() {
      this.decimateRatio = 1;
      $(this.$refs.decimateModal).modal("show");
    },
    decimateCancel() {
      $(this.$refs.decimateModal).modal("hide");
    },
    decimateApply() {
      $(this.$refs.decimateModal).modal("hide");
      let ratio = this.decimateRatio | 0;
      if (ratio < 1 || ratio > 20) {
        console.error("Ratio out of range:", ratio)
        return;
      }
      const pksize = 480;
      const stride = pksize * ratio;
      const offset = pksize * (ratio - 1) * 0.5 | 0;
      const n = Math.max((this.item!.length / stride + 0.5) | 0, 1);
      let slices: Slice[] = [];
      let segments: Segment[] = [];
      for (let i = 0; i < n; i++) {
        let name = this.item!.name + "." + i;
        slices.push({
          class: name,
          selected: true,
          pos: stride * i + offset,
          packets: [{length: pksize}],
          length: pksize,
        });
        segments.push({
          source: name,
          pos: stride * i,
          length: stride,
        });
      }
      this.slices = slices;
      this.segments = segments;
    },
  },
});
