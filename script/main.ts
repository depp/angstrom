import Vue from "vue";

import { drag } from "./drag";

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

new Vue({
  el: "#app",
});
