import Vue from "vue";
import VueRouter from "vue-router";

import "./waveform";
import { ClipList, Clip } from "./clip";

const router = new VueRouter({
  routes: [
    { path: "/clip", component: ClipList },
    { path: "/clip/:clipID", component: Clip },
  ],
});

const app = new Vue({
  router,
}).$mount("#app");
