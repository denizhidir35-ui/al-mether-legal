import { register } from "node:module";

register(
  "./typescript-relative-loader.mjs",
  import.meta.url
);
