// Debug configuration for rollup.js.
import sourcemaps from "rollup-plugin-sourcemaps";
import includePaths from "rollup-plugin-includepaths";
class ErrorResolver {
  resolveId(id, origin) {
    throw new Error("Unknown module " + id + " referenced from " + origin);
  }
}
export default {
  input: "main",
  output: {
    file: "game.js",
    format: "iife",
    name: "Game",
    sourcemap: true,
  },
  plugins: [
    includePaths({
      paths: ["game/cyber"],
      extensions: [".js"],
    }),
    new ErrorResolver(),
    sourcemaps(),
  ],
};
