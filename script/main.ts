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

const Input = Vue.extend({
  data() {
    return {
      loading: false,
      item: <InputInfo|null>null,
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
        .then((item: InputInfo) => {
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
/*
Vue.component("waveform", {
  props: ["url"],
  data: () => ({
    x: 0,
  }),
  template: "#waveform-template",
  methods: {
    startDrag: function(e: PointerEvent): void {
      let curX = this.x;
      console.log("START");
      drag(
        this.$el, e,
        (x: number, y: number): void => {
          this.x = curX + x;
        },
        () => {},
      );
    },
  },
});

Vue.component("inputlist", {
  props: ["items"],
  template: "#inputlist-template",
});

fetch("/input").then((r: Response) => r.json())
  .then((inputs: InputInfo[]) => {
    new Vue({
      el: "#app",
      data: {
        inputs: inputs,
      },
    });
  })
  .catch((e: Error) => console.error(e));
*/
