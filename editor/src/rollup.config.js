import sourcemaps from "rollup-plugin-sourcemaps";
import includePaths from "rollup-plugin-includepaths";
class ErrorResolver {
  resolveId(id, origin) {
    throw new Error("Unknown module " + id + " referenced from " + origin);
  }
}
export default {
  external: [
    "bootstrap-vue",
    "vue",
    "vue-router",
    "jquery",
  ],
  input: "editor/src/main",
  output: {
    file: "edit.js",
    format: "iife",
    name: "Edit",
    sourcemap: true,
    globals: {
      "vue": "Vue",
      "vue-router": "VueRouter",
      "jquery": "$",
    },
  },
  plugins: [
    includePaths({
      include: {},
      paths: ["."],
      external: [],
      extensions: [".js"],
    }),
    new ErrorResolver(),
    sourcemaps(),
  ],
};
