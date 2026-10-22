// Prints absolute paths under the project folder from that folder ("content/home.json"), with
// forward slashes, so content errors read the same on every machine. Windows paths are
// case-insensitive, so there the match is too.
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A function that rewrites every path under `root` (ending in a separator) in a message. */
export function pathsFromRoot(root, platform = process.platform) {
  const pattern = new RegExp(`${escape(root)}([^\\s'":]*)`, platform === "win32" ? "gi" : "g");
  return (message) => message.replace(pattern, (_, rest) => rest.replaceAll("\\", "/"));
}
