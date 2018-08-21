import sourcemaps from 'rollup-plugin-sourcemaps';
class ErrorResolver {
  resolveId(id, origin) {
    throw new Error("Unknown module " + id + " referenced from " + origin);
  }
}
export default {
  input: "script/main.js",
  output: {
    file: "edit.js",
    format: "iife",
    sourcemap: true,
  },
  plugins: [sourcemaps(), ErrorResolver],
};
