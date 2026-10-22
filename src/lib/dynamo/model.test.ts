import test from "node:test";
import assert from "node:assert/strict";
import {
  compareClocks,
  differingKeys,
  handoffStep,
  initialHandoff,
  mergeClocks,
  merkleTree,
  preferenceList,
  responseSet,
  ringTokens,
} from "./model";
import { chapters, glossary } from "./content";

test("ring ownership wraps, includes the right boundary, and skips duplicate physical hosts", () => {
  const tokens = [
    { host: "A", position: 10 },
    { host: "A", position: 20 },
    { host: "B", position: 40 },
    { host: "C", position: 80 },
  ];
  assert.deepEqual(preferenceList(tokens, 10), ["A", "B", "C"]);
  assert.deepEqual(preferenceList(tokens, 25), ["B", "C", "A"]);
  assert.deepEqual(preferenceList(tokens, 95), ["A", "B", "C"]);
});

test("adding host F only moves primary ownership to F, with and without virtual nodes", () => {
  for (const virtual of [false, true]) {
    let changed = 0;
    for (let position = 0; position < 100; position++) {
      const before = preferenceList(ringTokens(virtual, false), position);
      const after = preferenceList(ringTokens(virtual, true), position);
      assert.equal(new Set(after).size, 6);
      if (before[0] !== after[0]) {
        changed++;
        assert.equal(after[0], "F");
      }
    }
    assert.ok(changed > 0 && changed < 100);
  }
});

test("vector clocks compare causal history, not totals; missing entries are zero", () => {
  assert.equal(compareClocks({ A: 1 }, { A: 1, B: 0 }), "equal");
  assert.equal(compareClocks({ A: 1 }, { A: 2, B: 1 }), "ancestor");
  assert.equal(compareClocks({ A: 3, B: 1 }, { A: 2 }), "descendant");
  assert.equal(compareClocks({ A: 8, B: 1 }, { A: 1, B: 2 }), "concurrent");
});

test("Figure 3 reconciliation subsumes both siblings without mutating their clocks", () => {
  const d3 = { Sx: 2, Sy: 1 },
    d4 = { Sx: 2, Sz: 1 };
  const d5 = mergeClocks([d3, d4], "Sx");
  assert.equal(compareClocks(d3, d4), "concurrent");
  assert.deepEqual(d5, { Sx: 3, Sy: 1, Sz: 1 });
  assert.equal(compareClocks(d3, d5), "ancestor");
  assert.equal(compareClocks(d4, d5), "ancestor");
  assert.deepEqual(d3, { Sx: 2, Sy: 1 });
});

test("response thresholds wait for required hosts; sloppy quorum changes destinations, not W", () => {
  assert.equal(responseSet(3, 2, ["A", "B"], false, "write").success, false);
  const sloppy = responseSet(3, 2, ["A", "B"], true, "write");
  assert.equal(sloppy.success, true);
  assert.deepEqual(sloppy.selected, ["C", "D", "E"]);
  assert.equal(sloppy.replies.length, 2);
  assert.ok(sloppy.latency !== null);
  assert.equal(
    responseSet(3, 2, ["A", "B", "C", "D", "E"], true, "write").success,
    false,
  );
  assert.equal(responseSet(3, 1, [], false, "read").latency, 12);
  assert.equal(responseSet(3, 3, [], false, "read").latency, 65);
});

test("handoff requires a stored hint and recovery before delivery", () => {
  const initial = initialHandoff();
  assert.deepEqual(handoffStep(initial, "deliver"), initial);
  const failed = handoffStep(initial, "fail");
  const written = handoffStep(failed, "write");
  assert.equal(written.down, true);
  assert.equal(written.written, true);
  assert.equal(handoffStep(written, "deliver").delivered, false);
  const recovered = handoffStep(written, "recover");
  assert.equal(recovered.down, false);
  assert.equal(recovered.delivered, false);
  const delivered = handoffStep(recovered, "deliver");
  assert.equal(delivered.delivered, true);
  assert.equal(delivered.value, "book, camera");
  assert.deepEqual(handoffStep(delivered, "deliver"), delivered);
  assert.equal(initial.log.length, 1);
});

test("Merkle comparison locates only changed leaves across both sides of the tree", () => {
  const values = Array.from({ length: 8 }, (_, i) => `key${i}:v2`);
  const root = merkleTree(values);
  assert.deepEqual(differingKeys(root, merkleTree(values)), []);
  for (let key = 0; key < 8; key++) {
    const changed = values.map((value, i) =>
      i === key ? `key${i}:v1` : value,
    );
    assert.deepEqual(differingKeys(root, merkleTree(changed)), [key]);
  }
  assert.deepEqual(
    differingKeys(
      root,
      merkleTree(
        values.map((value, i) => ([1, 6].includes(i) ? "old" : value)),
      ),
    ),
    [1, 6],
  );
});

test("reading guide and glossary references are complete and unambiguous", () => {
  assert.equal(
    new Set(chapters.map((chapter) => chapter.id)).size,
    chapters.length,
  );
  for (const chapter of chapters) {
    for (const name of chapter.terms)
      assert.ok(
        glossary.some((term) => term.term === name),
        `${chapter.id}: missing ${name}`,
      );
    assert.ok(chapter.page >= 1 && chapter.page <= 16);
  }
  for (const term of glossary)
    assert.ok(
      chapters.some((chapter) => chapter.id === term.chapter),
      term.term,
    );
});
