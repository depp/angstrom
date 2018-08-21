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
  ],
  input: "script/main",
  output: {
    file: "edit.js",
    format: "iife",
    name: "Edit",
    sourcemap: true,
    globals: {
      "vue": "Vue",
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
