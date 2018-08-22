import Vue from "vue";

let icons: {[s: string]: Promise<SVGElement>} = {};

function getIcon(name: string): Promise<SVGElement> {
  let icon = icons[name];
  if (!icon) {
    icon = fetch("/icon/" + name)
      .then((r: Response) => {
        if (!r.ok) {
          throw Error(r.statusText);
        }
        return r.text();
      })
      .then((t: string) => {
        console.log("T", t);
        let parser = new DOMParser;
        let doc = parser.parseFromString(t, "image/svg+xml");
        console.log("DOC", doc.documentElement);
        return doc.documentElement as any as SVGElement;
      });
    icons[name] = icon;
  }
  return icon;
}

Vue.component("icon", {
  props: {
    name: String,
    size: {
      type: Number,
      default: 24,
    },
  },
  template: (`<svg ref="icon" `+
             `v-bind="{width: size, height: size}" `+
             `xmlns="http://www.w3.org/2000/svg"></svg>`),
  created() {
    getIcon(this.name)
      .then((elt: SVGElement) => {
        let src = elt.cloneNode(true) as SVGElement;
        console.log("ICON", this.$refs.icon);
        let dest = this.$refs.icon as HTMLElement;
        for (let i = 0; i < src.attributes.length; i++) {
          let attrib = src.attributes[i];
          dest.setAttributeNS(
            attrib.namespaceURI!, attrib.localName!, attrib.value);
        }
        while (src.firstChild) {
          let child = src.firstChild;
          src.removeChild(child);
          dest.appendChild(child);
        }
      });
  },
});
