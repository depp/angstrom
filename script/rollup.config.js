import sourcemaps from "rollup-plugin-sourcemaps";
import includePaths from "rollup-plugin-includepaths";
class ErrorResolver {
  resolveId(id, origin) {
    throw new Error("Unknown module " + id + " referenced from " + origin);
  }
}
export default {
  external: [
    "vue",
  ],
  input: "script/main",
  name: "Edit",
  output: {
    file: "edit.js",
    format: "iife",
    name: "Edit",
    sourcemap: true,
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
