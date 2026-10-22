"use client";
import { useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { type LabId } from "@/lib/dynamo/content";
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
  teachingHash,
  type Clock,
  type MerkleNode,
} from "@/lib/dynamo/model";

const colors: Record<string, string> = {
  A: "#e8bc6a",
  B: "#6897ff",
  C: "#5bcca0",
  D: "#bb9bea",
  E: "#ee8290",
  F: "#77d2df",
};
const names: Record<LabId, { title: string; hint: string }> = {
  ring: {
    title: "The hash ring",
    hint: "Change the key. Follow its replicas.",
  },
  quorum: {
    title: "The quorum workbench",
    hint: "Change the thresholds. Take hosts offline.",
  },
  versions: {
    title: "Two histories, one cart",
    hint: "Step through Figure 3’s causal history.",
  },
  handoff: {
    title: "A failure, then a handoff",
    hint: "Follow the temporary copy back home.",
  },
  merkle: {
    title: "Find the stale replica",
    hint: "Compare a shared range of eight keys.",
  },
  latency: {
    title: "Small tails add up",
    hint: "Explore how dependencies amplify latency.",
  },
};
export function Lab({ id }: { id: LabId }) {
  return (
    <section className="d-lab" aria-label={names[id].title}>
      <div className="d-lab-heading">
        <span className="d-live-dot" /> Interactive lab{" "}
        <span>Local simulation</span>
      </div>
      <h2>{names[id].title}</h2>
      <p className="d-lab-hint">{names[id].hint}</p>
      {id === "ring" ? (
        <RingLab />
      ) : id === "quorum" ? (
        <QuorumLab />
      ) : id === "versions" ? (
        <VersionsLab />
      ) : id === "handoff" ? (
        <HandoffLab />
      ) : id === "merkle" ? (
        <MerkleLab />
      ) : (
        <LatencyLab />
      )}
    </section>
  );
}
function Reset({ onClick }: { onClick: () => void }) {
  return (
    <button className="d-reset" onClick={onClick}>
      <RotateCcw size={13} /> Reset lab
    </button>
  );
}
function RingLab() {
  const [key, setKey] = useState("cart:alice");
  const [virtual, setVirtual] = useState(false);
  const [added, setAdded] = useState(false);
  const [n, setN] = useState(3);
  const tokens = ringTokens(virtual, added);
  const position = teachingHash(key) % 100;
  const preference = preferenceList(tokens, position);
  const replicas = preference.slice(0, n);
  const angle = (value: number) => (value / 100) * Math.PI * 2 - Math.PI / 2;
  const point = (value: number, radius: number) => ({
    x: 180 + Math.cos(angle(value)) * radius,
    y: 165 + Math.sin(angle(value)) * radius,
  });
  const keyPoint = point(position, 93);
  const owner = tokens.find((token) => token.position >= position) ?? tokens[0];
  const ownerPoint = point(owner.position, 118);
  const moved = Array.from(
    { length: 100 },
    (_, i) =>
      preferenceList(ringTokens(virtual, false), i)[0] !==
      preferenceList(tokens, i)[0],
  ).filter(Boolean).length;
  return (
    <>
      <div className="d-lab-controls">
        <label>
          Object key
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          Replicas (N)
          <select value={n} onChange={(event) => setN(+event.target.value)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <svg
        className="d-ring"
        viewBox="0 0 360 330"
        role="img"
        aria-label={`Key ${key || "(empty)"} hashes to ${position}. Normal replicas: ${replicas.join(", ")}. Walk clockwise.`}
      >
        <circle
          cx="180"
          cy="165"
          r="118"
          fill="none"
          stroke="#30394a"
          strokeWidth="2"
        />
        <circle
          cx="180"
          cy="165"
          r="93"
          fill="none"
          stroke="#242c39"
          strokeDasharray="3 6"
        />
        <path
          d="M 165 28 L 181 28 L 176 23 M 181 28 L 176 33"
          fill="none"
          stroke="#8390a4"
          strokeWidth="1.5"
        />
        <line
          x1={keyPoint.x}
          y1={keyPoint.y}
          x2={ownerPoint.x}
          y2={ownerPoint.y}
          stroke="#e8bc6a"
          strokeDasharray="4 4"
        />
        {tokens.map((token) => {
          const p = point(token.position, 118),
            label = point(token.position, 142);
          return (
            <g key={`${token.host}-${token.position}`}>
              <title>Host {token.host}, token at {token.position}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={virtual ? 7 : 13}
                fill={
                  replicas.includes(token.host) ? colors[token.host] : "#191e29"
                }
                stroke={colors[token.host]}
                strokeWidth="2"
              />
              <text
                x={label.x}
                y={label.y + 4}
                textAnchor="middle"
                fill={colors[token.host]}
                fontSize="12"
              >
                {token.host}
              </text>
            </g>
          );
        })}
        <circle
          cx={keyPoint.x}
          cy={keyPoint.y}
          r="5"
          fill="#e8bc6a"
          stroke="#0e1118"
          strokeWidth="2"
        />
        <text x="180" y="146" textAnchor="middle" fill="#8390a4" fontSize="11">
          Key position
        </text>
        <text
          x="180"
          y="180"
          textAnchor="middle"
          fill="#e8bc6a"
          fontSize="30"
          fontFamily="var(--font-mono)"
        >
          {position}
        </text>
        <text x="180" y="203" textAnchor="middle" fill="#aebbd0" fontSize="11">
          Walk clockwise to {preference[0]}
        </text>
      </svg>
      <div className="d-replica-path" aria-label="Preference list">
        {preference.map((host, index) => (
          <span
            key={host}
            className={index < n ? "selected" : ""}
            style={{ borderColor: index < n ? colors[host] : undefined }}
          >
            <b style={{ color: colors[host] }}>{host}</b>
            <small>
              {index === 0 ? "Owner" : index < n ? "Replica" : "Fallback"}
            </small>
          </span>
        ))}
      </div>
      <div className="d-lab-actions">
        <label className="d-checkbox">
          <input
            type="checkbox"
            checked={virtual}
            onChange={(event) => setVirtual(event.target.checked)}
          />{" "}
          Three tokens per host
        </label>
        <button
          className="d-button"
          aria-pressed={added}
          onClick={() => setAdded(!added)}
        >
          {added ? "Remove host F" : "Add host F"}
        </button>
      </div>
      <p className="d-result" aria-live="polite">
        {added
          ? `${moved} of 100 sampled positions changed primary owner after F joined.`
          : `${tokens.length} tokens, ${preference.length} physical hosts. N = ${n} means ${n} distinct hosts, even with virtual nodes.`}
      </p>
      <p className="d-lab-note">
        Teaching model: a 0–99 ring, fixed tokens, and a small non-cryptographic
        hash. The paper uses MD5 and a 128-bit ring. This illustrates §4.2, not
        all §6.2 placement strategies.
      </p>
      <Reset
        onClick={() => {
          setKey("cart:alice");
          setVirtual(false);
          setAdded(false);
          setN(3);
        }}
      />
    </>
  );
}
function QuorumLab() {
  const [n, setN] = useState(3),
    [r, setR] = useState(2),
    [w, setW] = useState(2);
  const [down, setDown] = useState<string[]>([]);
  const [sloppy, setSloppy] = useState(false);
  const [operation, setOperation] = useState<"read" | "write">("write");
  const required = operation === "read" ? r : w;
  const result = responseSet(n, required, down, sloppy, operation);
  return (
    <>
      <div className="d-parameter-row">
        {[
          {
            label: "N · replicas",
            value: n,
            change: (value: number) => {
              setN(value);
              setR(Math.min(r, value));
              setW(Math.min(w, value));
            },
            max: 5,
          },
          { label: "R · read replies", value: r, change: setR, max: n },
          { label: "W · write acks", value: w, change: setW, max: n },
        ].map((control) => (
          <label key={control.label}>
            {control.label}
            <select
              value={control.value}
              onChange={(event) => control.change(+event.target.value)}
            >
              {Array.from({ length: control.max }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="d-segmented" aria-label="Operation">
        <button
          aria-pressed={operation === "write"}
          onClick={() => setOperation("write")}
        >
          put · write
        </button>
        <button
          aria-pressed={operation === "read"}
          onClick={() => setOperation("read")}
        >
          get · read
        </button>
      </div>
      <p className="d-small">Click a host to change reachability.</p>
      <div className="d-host-grid">
        {["A", "B", "C", "D", "E", "F"].map((host) => (
          <button
            key={host}
            aria-label={`${host}: ${down.includes(host) ? "offline, recover host" : "online, fail host"}`}
            aria-pressed={down.includes(host)}
            className={`${down.includes(host) ? "offline" : result.selected.includes(host) ? "participating" : ""}`}
            onClick={() =>
              setDown(
                down.includes(host)
                  ? down.filter((item) => item !== host)
                  : [...down, host],
              )
            }
          >
            <strong>{host}</strong>
            <span>
              {down.includes(host)
                ? "Offline"
                : result.normal.includes(host)
                  ? "Normal replica"
                  : "Fallback"}
            </span>
            <small>
              {result.replies.some((reply) => reply.host === host)
                ? "Counted reply"
                : result.selected.includes(host)
                  ? "Also contacted"
                  : "Not contacted"}
            </small>
          </button>
        ))}
      </div>
      <label className="d-checkbox">
        <input
          type="checkbox"
          checked={sloppy}
          onChange={(event) => setSloppy(event.target.checked)}
        />{" "}
        Use sloppy quorum (healthy substitutes)
      </label>
      <div
        className={`d-result ${result.success ? "" : "warning"}`}
        aria-live="polite"
      >
        <strong>
          {result.success
            ? `${operation === "write" ? "Write" : "Read"} succeeds · ${result.latency} ms`
            : "Not enough reachable hosts"}
        </strong>
        <p>
          {result.success
            ? `${required} required ${operation === "write" ? "acknowledgements" : "responses"} from ${result.replies.map((reply) => reply.host).join(", ")}. ${result.selected.length} hosts contacted in total.`
            : `Only ${result.selected.length} selected hosts can respond; ${required} required. The operation would time out. A timed-out write may still have reached some replicas.`}
        </p>
      </div>
      <div className="d-equation">
        R + W {r + w > n ? ">" : "≤"} N{" "}
        <span>
          {r} + {w} {r + w > n ? ">" : "≤"} {n}
        </span>
      </div>
      <p className="d-small">
        {r + w > n
          ? "Read/write overlap holds within the same fixed replica set. It alone does not establish linearizability."
          : "A read and write can succeed using disjoint responses, even within the normal replica set."}{" "}
        {sloppy &&
          "Substitute sets can differ across operations, so the overlap argument may no longer apply."}
      </p>
      <p className="d-lab-note">
        Deterministic response times are illustrative. This workbench models
        response thresholds, not a stored-value history, retries, or real
        network timing. The handoff lab traces stored copies.
      </p>
      <Reset
        onClick={() => {
          setN(3);
          setR(2);
          setW(2);
          setDown([]);
          setSloppy(false);
          setOperation("write");
        }}
      />
    </>
  );
}
const history: { id: string; clock: Clock; value: string; text: string }[] = [
  {
    id: "D1",
    clock: { Sx: 1 },
    value: "book",
    text: "Sx creates the first cart. Its counter is 1.",
  },
  {
    id: "D2",
    clock: { Sx: 2 },
    value: "book, pen",
    text: "A second write through Sx observes D1 and increments Sx. D2 supersedes D1.",
  },
  {
    id: "D3",
    clock: { Sx: 2, Sy: 1 },
    value: "book, pen, camera",
    text: "Sy receives D2’s context and adds a camera. D3 supersedes D2.",
  },
  {
    id: "D4",
    clock: { Sx: 2, Sz: 1 },
    value: "book, pen, headphones",
    text: "Sz also starts from D2, unaware of D3. D3 and D4 are concurrent: keep both.",
  },
  {
    id: "D5",
    clock: mergeClocks(
      [
        { Sx: 2, Sy: 1 },
        { Sx: 2, Sz: 1 },
      ],
      "Sx",
    ),
    value: "book, pen, camera, headphones",
    text: "The application reads both siblings and unions the items. Sx merges their context and increments its counter. D5 supersedes both.",
  },
];
const clockText = (clock: Clock) =>
  `{${Object.entries(clock)
    .map(([node, value]) => `${node}:${value}`)
    .join(", ")}}`;
function VersionsLab() {
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(2),
    [right, setRight] = useState(3);
  const current = history[step];
  const positions = [
    { x: 170, y: 30 },
    { x: 170, y: 92 },
    { x: 80, y: 164 },
    { x: 260, y: 164 },
    { x: 170, y: 243 },
  ];
  return (
    <>
      <svg
        viewBox="0 0 340 280"
        className="d-version-graph"
        role="img"
        aria-label={`Version history through ${current.id}. D3 and D4 branch from D2, then merge into D5.`}
      >
        {[
          [0, 1],
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
        ].map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={positions[from].x}
            y1={positions[from].y + 16}
            x2={positions[to].x}
            y2={positions[to].y - 16}
            stroke={to <= step ? "#b09566" : "#293141"}
            strokeWidth="2"
            strokeDasharray={to <= step ? undefined : "4 4"}
          />
        ))}
        {history.map((version, index) => (
          <g key={version.id} opacity={index <= step ? 1 : 0.35}>
            <rect
              x={positions[index].x - 35}
              y={positions[index].y - 17}
              width="70"
              height="34"
              rx="6"
              fill={index === step ? "#493d27" : "#1b2230"}
              stroke={index <= step ? "#e8bc6a" : "#455067"}
            />
            <text
              x={positions[index].x}
              y={positions[index].y + 5}
              textAnchor="middle"
              fill="#e5dfd2"
              fontSize="13"
            >
              {version.id}
            </text>
          </g>
        ))}
      </svg>
      <div className="d-version-state" aria-live="polite">
        <div>
          <b>{current.id}</b>
          <code>{clockText(current.clock)}</code>
        </div>
        <p>[{current.value}]</p>
        <p>{current.text}</p>
      </div>
      <div className="d-lab-actions">
        <button
          className="d-button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Previous
        </button>
        <span>{step + 1} / 5</span>
        <button
          className="d-button primary"
          disabled={step === 4}
          onClick={() => setStep(step + 1)}
        >
          {step === 3 ? "Reconcile siblings" : "Next write"}
          <ArrowRight size={13} />
        </button>
      </div>
      <h3 className="d-mini-heading">Compare any two clocks</h3>
      <div className="d-clock-select">
        {[
          { label: "First version", value: left, change: setLeft },
          { label: "Second version", value: right, change: setRight },
        ].map((control) => (
          <label key={control.label}>
            {control.label}
            <select
              value={control.value}
              onChange={(event) => control.change(+event.target.value)}
            >
              {history.map((version, i) => (
                <option key={version.id} value={i}>
                  {version.id} {clockText(version.clock)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="d-result" aria-live="polite">
        {history[left].id} compared with {history[right].id}:{" "}
        <strong>
          {compareClocks(history[left].clock, history[right].clock)}
        </strong>
        .
      </p>
      <p className="d-lab-note">
        The D1–D5 clocks follow Figure 3. Cart contents are illustrative. Union
        preserves additions but may resurrect items removed in one branch; this
        is an application policy, not an automatic Dynamo merge.
      </p>
      <Reset
        onClick={() => {
          setStep(0);
          setLeft(2);
          setRight(3);
        }}
      />
    </>
  );
}
function HandoffLab() {
  const [state, setState] = useState(initialHandoff);
  const phase =
    !state.down && !state.written
      ? 0
      : state.down && !state.written
        ? 1
        : state.down
          ? 2
          : !state.delivered
            ? 3
            : 4;
  const actions: ("fail" | "write" | "recover" | "deliver")[] = [
    "fail",
    "write",
    "recover",
    "deliver",
  ];
  const labels = [
    "Fail host A",
    "Write: add camera",
    "Recover host A",
    "Deliver hint to A",
  ];
  return (
    <>
      <div className="d-handoff-hosts">
        {["A", "B", "C", "D"].map((host) => {
          const hint = host === "D" && state.written && !state.delivered;
          const value =
            host === "D"
              ? hint
                ? state.value
                : "No copy"
              : host === "A"
                ? state.delivered
                  ? state.value
                  : "book"
                : state.value;
          return (
            <div
              className={`${host === "A" && state.down ? "offline" : ""} ${hint ? "hinted" : ""}`}
              key={host}
            >
              <strong>Host {host}</strong>
              <span>
                {host === "D"
                  ? hint
                    ? "Hint → A"
                    : "Fallback"
                  : host === "A" && state.down
                    ? "Unreachable"
                    : "Normal replica"}
              </span>
              <code>{value}</code>
            </div>
          );
        })}
      </div>
      <div className="d-lab-actions">
        <span>Step {phase} of 4</span>
        <button
          className="d-button primary"
          disabled={phase === 4}
          onClick={() => {
            if (phase < 4) setState(handoffStep(state, actions[phase]));
          }}
        >
          {phase === 4 ? "Handoff complete" : labels[phase]}
          {phase === 4 ? <Check size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>
      <ol className="d-event-log" aria-live="polite">
        {state.log.map((entry, index) => (
          <li key={entry}>
            <span>{index}</span>
            <p>{entry}</p>
          </li>
        ))}
      </ol>
      <p className="d-lab-note">
        One scripted transient outage, N = 3 and W = 2. D’s temporary copy is
        delivered explicitly; real nodes retry in the background. This omits
        timing, repeated failures, and per-peer reachability differences.
      </p>
      <Reset onClick={() => setState(initialHandoff())} />
    </>
  );
}
function TreeRow({
  a,
  b,
  compared,
}: {
  a: MerkleNode;
  b: MerkleNode;
  compared: boolean;
}) {
  const different = a.hash !== b.hash;
  return (
    <div className="d-tree-branch">
      <div
        className={`d-tree-node ${compared ? (different ? "different" : "matching") : ""}`}
      >
        <span>
          {a.start === a.end
            ? `key ${a.start + 1}`
            : `keys ${a.start + 1}–${a.end + 1}`}
        </span>
        <small aria-label={!compared ? "Unchecked" : undefined}>
          {compared ? (different ? "Differs" : "Matches") : "—"}
        </small>
      </div>
      {a.children.length > 0 && (
        <div className="d-tree-children">
          {a.children.map((child, i) => (
            <TreeRow
              key={child.start}
              a={child}
              b={b.children[i]}
              compared={compared && different}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function MerkleLab() {
  const [stale, setStale] = useState(5);
  const [compared, setCompared] = useState(false),
    [repaired, setRepaired] = useState(false);
  const values = Array.from({ length: 8 }, (_, i) => `cart:${i + 1}:v2`);
  const other = values.map((value, i) =>
    i === stale && !repaired ? `cart:${i + 1}:v1` : value,
  );
  const a = merkleTree(values),
    b = merkleTree(other);
  const differences = differingKeys(a, b);
  return (
    <>
      <label className="d-field">
        Stale key on replica B
        <select
          value={stale}
          onChange={(event) => {
            setStale(+event.target.value);
            setCompared(false);
            setRepaired(false);
          }}
        >
          {values.map((_, i) => (
            <option key={i} value={i}>
              cart:{i + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="d-root-hashes">
        <span>
          Replica A <code>{a.hash}</code>
        </span>
        <span>
          Replica B <code>{b.hash}</code>
        </span>
      </div>
      <div className="d-tree" aria-label="Comparison tree">
        <TreeRow a={a} b={b} compared={compared} />
      </div>
      <div className="d-lab-actions">
        <button
          className="d-button"
          disabled={compared}
          onClick={() => setCompared(true)}
        >
          Compare roots
        </button>
        <button
          className="d-button primary"
          disabled={!compared || repaired}
          onClick={() => setRepaired(true)}
        >
          Repair differing key
        </button>
      </div>
      <p className="d-result" aria-live="polite">
        {!compared
          ? "Compare the roots to start. Gray descendants have not been inspected."
          : differences.length
            ? `Roots differ. Follow the amber path to cart:${differences[0] + 1}. Matching green subtrees need no descent.`
            : "Roots match. All eight keys agree; no subtree comparisons are needed."}
      </p>
      <p className="d-lab-note">
        One known ancestor version is stale, so repair can copy v2. Hash labels
        use a small teaching hash, not a collision-resistant production hash.
        Concurrent versions would require reconciliation, not a blind overwrite.
      </p>
      <Reset
        onClick={() => {
          setStale(5);
          setCompared(false);
          setRepaired(false);
        }}
      />
    </>
  );
}
function LatencyLab() {
  const [dependencies, setDependencies] = useState(150),
    [slowPercent, setSlowPercent] = useState(0.1);
  const probability = 100 * (1 - (1 - slowPercent / 100) ** dependencies);
  return (
    <>
      <label className="d-slider">
        Dependencies per page <output>{dependencies}</output>
        <input
          type="range"
          min="1"
          max="300"
          value={dependencies}
          onChange={(event) => setDependencies(+event.target.value)}
        />
      </label>
      <label className="d-slider">
        Chance each call is slow <output>{slowPercent}%</output>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={slowPercent}
          onChange={(event) => setSlowPercent(+event.target.value)}
        />
      </label>
      <div className="d-probability" aria-live="polite">
        <strong>
          {probability.toFixed(1)}
          <span>%</span>
        </strong>
        <p>of pages encounter at least one slow dependency</p>
      </div>
      <div
        className="d-probability-bar"
        role="img"
        aria-label={`${probability.toFixed(1)} percent encounter a slow dependency`}
      >
        <span style={{ width: `${probability}%` }} />
      </div>
      <div className="d-equation">
        1 − (1 − p)<sup>k</sup>
      </div>
      <p className="d-small">
        Here p = {(slowPercent / 100).toFixed(3)} and k = {dependencies}. A
        single dependency has a {slowPercent}% slow-call probability; a page
        waiting for {dependencies} independent dependencies sees at least one
        slow call {probability.toFixed(1)}% of the time.
      </p>
      <p className="d-lab-note">
        An illustrative probability model, not measured Dynamo performance.
        Assumes independent calls with equal slow-call probabilities and a page
        that waits for every dependency. Real dependencies can be correlated.
      </p>
      <Reset
        onClick={() => {
          setDependencies(150);
          setSlowPercent(0.1);
        }}
      />
    </>
  );
}
