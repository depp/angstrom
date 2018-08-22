import Vue from "vue";
import VueRouter from "vue-router";

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
