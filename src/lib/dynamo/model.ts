export type Token = { host: string; position: number };
export type Clock = Record<string, number>;
// Small deterministic teaching hash. The paper uses MD5 over a 128-bit ring.
export function teachingHash(value: string): number {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function ringTokens(virtual: boolean, added: boolean): Token[] {
  const positions: Record<string, number[]> = {
    A: [7, 41, 74],
    B: [23, 44, 90],
    C: [37, 63, 94],
    D: [58, 15, 81],
    E: [86, 31, 68],
    F: [19, 53, 97],
  };
  return Object.entries(positions)
    .filter(([host]) => added || host !== "F")
    .flatMap(([host, values]) =>
      (virtual ? values : values.slice(0, 1)).map((position) => ({
        host,
        position,
      })),
    )
    .sort((a, b) => a.position - b.position);
}
export function preferenceList(tokens: Token[], position: number): string[] {
  const start = tokens.findIndex((token) => token.position >= position);
  const ordered =
    start < 0 ? tokens : [...tokens.slice(start), ...tokens.slice(0, start)];
  return [...new Set(ordered.map((token) => token.host))];
}
export function compareClocks(
  a: Clock,
  b: Clock,
): "equal" | "ancestor" | "descendant" | "concurrent" {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let less = false,
    greater = false;
  for (const key of keys) {
    if ((a[key] ?? 0) < (b[key] ?? 0)) less = true;
    if ((a[key] ?? 0) > (b[key] ?? 0)) greater = true;
  }
  return less && greater
    ? "concurrent"
    : less
      ? "ancestor"
      : greater
        ? "descendant"
        : "equal";
}
export function mergeClocks(clocks: Clock[], coordinator: string): Clock {
  const merged: Clock = {};
  for (const clock of clocks)
    for (const [node, value] of Object.entries(clock))
      merged[node] = Math.max(merged[node] ?? 0, value);
  merged[coordinator] = (merged[coordinator] ?? 0) + 1;
  return merged;
}
export function responseSet(
  n: number,
  required: number,
  down: string[],
  sloppy: boolean,
  operation: "read" | "write",
) {
  const hosts = ["A", "B", "C", "D", "E", "F"];
  const normal = hosts.slice(0, n);
  const selected = (sloppy ? hosts : normal)
    .filter((host) => !down.includes(host))
    .slice(0, n);
  // A write coordinator persists locally before collecting remote acknowledgements.
  const coordinator = selected[0];
  const times = [12, 28, 65, 95, 130, 180];
  const candidates = selected.map((host) => ({
    host,
    ms:
      times[hosts.indexOf(host)] +
      (operation === "write" && host !== coordinator ? 12 : 0),
  }));
  const replies = candidates.slice(0, required);
  return {
    normal,
    selected,
    replies,
    success: replies.length >= required,
    latency: replies.length >= required ? replies.at(-1)!.ms : null,
  };
}
export type HandoffState = {
  down: boolean;
  written: boolean;
  delivered: boolean;
  value: string;
  log: string[];
};
export function initialHandoff(): HandoffState {
  return {
    down: false,
    written: false,
    delivered: false,
    value: "book",
    log: ["A, B, C hold the original cart: [book]. N = 3, W = 2."],
  };
}
export function handoffStep(
  state: HandoffState,
  action: "fail" | "write" | "recover" | "deliver",
): HandoffState {
  const next = { ...state, log: [...state.log] };
  if (action === "fail" && !state.written && !state.down) {
    next.down = true;
    next.log.push(
      "A becomes unreachable. Its normal ownership stays in the ring.",
    );
  } else if (action === "write" && state.down && !state.written) {
    next.written = true;
    next.value = "book, camera";
    next.log.push(
      "B coordinates the write. B and C acknowledge (W = 2); D also stores a temporary copy with a hint for A.",
    );
  } else if (action === "recover" && state.down && state.written) {
    next.down = false;
    next.log.push(
      "A is reachable again but still has [book]. Recovery alone does not deliver the hint.",
    );
  } else if (
    action === "deliver" &&
    !state.down &&
    state.written &&
    !state.delivered
  ) {
    next.delivered = true;
    next.log.push(
      "D transfers [book, camera] to A. After successful delivery, D removes its hinted copy.",
    );
  }
  return next;
}
export type MerkleNode = {
  hash: string;
  start: number;
  end: number;
  children: MerkleNode[];
};
export function merkleTree(values: string[], start = 0): MerkleNode {
  if (values.length === 0)
    throw new Error("A Merkle tree requires at least one value.");
  const middle = Math.floor(values.length / 2);
  const children =
    values.length === 1
      ? []
      : [
          merkleTree(values.slice(0, middle), start),
          merkleTree(values.slice(middle), start + middle),
        ];
  const material = children.length
    ? `branch:${children.map((child) => child.hash).join(":")}`
    : `leaf:${start}:${values[0]}`;
  return {
    hash: teachingHash(material).toString(16).padStart(8, "0"),
    start,
    end: start + values.length - 1,
    children,
  };
}
export function differingKeys(a: MerkleNode, b: MerkleNode): number[] {
  if (a.hash === b.hash) return [];
  if (!a.children.length) return [a.start];
  return a.children.flatMap((child, index) =>
    differingKeys(child, b.children[index]),
  );
}
