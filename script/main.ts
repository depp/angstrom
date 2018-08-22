import Vue from "vue";
import VueRouter from "vue-router";

import { Clip } from "./audio";

import "./waveform";

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
      error: null as Error|null,
      item: null as InputData|null,
      data: null as Float32Array|null,
      clip: null as Clip|null,
      scale: 32,
      pos: 0,
    };
  },
  created() {
    this.fetchData();
  },
  template: "#input-template",
  computed: {
    url(): string {
      return "/input/" + this.$route.params.inputId;
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
        fetch(url + "/audio/data")
          .then((r: Response) => {
            if (!r.ok)
              throw Error(r.statusText);
            return r.arrayBuffer();
          }),
      ]).then(([item, data]) => {
        this.loading = false;
        this.item = item;
        this.data = new Float32Array(data);
        this.clip = new Clip(this.data);
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
    }
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
