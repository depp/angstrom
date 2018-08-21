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

interface InputInfo {
  url: string;
  name: string;
}

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
