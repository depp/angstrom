import Vue from "vue";
import VueRouter from "vue-router";

import "./waveform";
import { ClipList, Clip } from "./clip";

const router = new VueRouter({
  routes: [
    { path: "/clip", component: ClipList },
    { path: "/clip/:clipID", component: Clip },
    // { path: "/clip/:clipID/slice/:sliceID", component: Slice },
    // { path: "/clip/:clipID/segment/:segmentID", component: Segment },
  ],
});

const app = new Vue({
  router,
}).$mount("#app");
