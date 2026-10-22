import test from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  allocation,
  createInitialState,
  dispatch,
  endpoints,
} from "./engine";
import { ClusterState } from "./types";
const managed = (s: ClusterState, id = "frontend") =>
  s.pods.filter((p) => p.deploymentId === id && p.phase !== "Terminating");
function capacity(s: ClusterState) {
  for (const n of s.nodes) {
    const a = allocation(s, n.id);
    assert.ok(a.cpu <= n.cpu, `${n.id} CPU oversubscribed`);
    assert.ok(a.memory <= n.memory, `${n.id} memory oversubscribed`);
  }
}
test("initial cluster is healthy, deterministic, and has realistic ownership", () => {
  const s = createInitialState();
  assert.deepEqual(s, createInitialState());
  assert.equal(s.nodes.length, 3);
  assert.equal(s.pods.length, 9);
  assert.ok(
    s.pods.every((p) => p.phase === "Running" && p.replicaSet && p.nodeId),
  );
  capacity(s);
});
test("scale creates Pending pods, schedules, starts, and scales down", () => {
  let s = dispatch(createInitialState(), {
    type: "scale",
    id: "frontend",
    replicas: 5,
  });
  assert.equal(managed(s).length, 3);
  s = advance(s);
  assert.equal(managed(s).length, 5);
  assert.equal(managed(s).filter((p) => p.phase === "Pending").length, 2);
  s = advance(s);
  assert.equal(
    managed(s).filter((p) => p.phase === "ContainerCreating").length,
    2,
  );
  s = advance(s, 2);
  assert.equal(managed(s).filter((p) => p.phase === "Running").length, 5);
  s = dispatch(s, { type: "scale", id: "frontend", replicas: 1 });
  s = advance(s, 4);
  assert.equal(managed(s).length, 1);
  capacity(s);
});
test("deleting a managed pod creates a new identity after reconciliation", () => {
  let s = createInitialState();
  const deleted = managed(s)[0];
  s = dispatch(s, { type: "delete-pod", id: deleted.id });
  assert.equal(s.pods.find((p) => p.id === deleted.id)?.phase, "Terminating");
  assert.equal(managed(s).length, 2);
  s = advance(s);
  assert.equal(managed(s).length, 3);
  assert.ok(managed(s).some((p) => p.phase === "Pending"));
  s = advance(s, 4);
  assert.ok(!s.pods.some((p) => p.id === deleted.id));
  assert.equal(managed(s).filter((p) => p.phase === "Running").length, 3);
  capacity(s);
});
test("unmanaged pod deletion does not recreate the pod", () => {
  let s = createInitialState();
  s.pods.push({
    ...s.pods[0],
    id: "unmanaged",
    name: "debug-pod",
    deploymentId: undefined,
    replicaSet: undefined,
  });
  s = dispatch(s, { type: "delete-pod", id: "unmanaged" });
  s = advance(s, 8);
  assert.equal(s.pods.length, 9);
  assert.ok(!s.pods.some((p) => p.id === "unmanaged"));
});
test("over-capacity pods remain Pending with FailedScheduling events", () => {
  let s = dispatch(createInitialState(), {
    type: "create-deployment",
    name: "too-large",
    namespace: "production",
    image: "nginx:1.25",
    replicas: 2,
    cpu: 5000,
    memory: 512,
  });
  s = advance(s, 20);
  assert.equal(managed(s, "production/too-large").length, 2);
  assert.ok(
    managed(s, "production/too-large").every(
      (p) => p.phase === "Pending" && !p.nodeId,
    ),
  );
  assert.ok(s.events.some((e) => e.reason === "FailedScheduling"));
  capacity(s);
});
test("scheduler respects aggregate requests and zone constraints", () => {
  let s = dispatch(createInitialState(), {
    type: "create-deployment",
    name: "zone-workload",
    namespace: "production",
    image: "nginx",
    replicas: 4,
    cpu: 1500,
    memory: 1024,
    nodeSelector: "us-east-1b",
  });
  s = advance(s, 10);
  const pods = managed(s, "production/zone-workload");
  assert.ok(
    pods.filter((p) => p.nodeId).every((p) => p.nodeId === "worker-02"),
  );
  assert.ok(pods.some((p) => p.phase === "Pending"));
  capacity(s);
});
test("node failure has detection and eviction delay, not immediate relocation", () => {
  let s = createInitialState();
  const onNode = s.pods
    .filter((p) => p.nodeId === "worker-01")
    .map((p) => p.id);
  s = dispatch(s, { type: "fail-node", id: "worker-01" });
  assert.equal(s.nodes[0].status, "Ready");
  s = advance(s, 4);
  assert.ok(
    onNode.every((id) =>
      s.pods.some((p) => p.id === id && p.nodeId === "worker-01"),
    ),
  );
  s = advance(s);
  assert.equal(s.nodes[0].status, "NotReady");
  assert.ok(
    onNode.every((id) =>
      s.pods.some((p) => p.id === id && p.phase === "Unknown"),
    ),
  );
  s = advance(s, 11);
  assert.ok(onNode.every((id) => s.pods.some((p) => p.id === id)));
  s = advance(s, 6);
  assert.ok(onNode.every((id) => !s.pods.some((p) => p.id === id)));
  assert.ok(s.pods.every((p) => p.nodeId !== "worker-01"));
  assert.equal(s.pods.filter((p) => p.phase === "Running").length, 9);
  capacity(s);
});
test("node recovery cancels eviction and restarts unknown pods", () => {
  let s = dispatch(createInitialState(), {
    type: "fail-node",
    id: "worker-01",
  });
  s = advance(s, 6);
  const ids = s.pods.map((p) => p.id);
  s = dispatch(s, { type: "recover-node", id: "worker-01" });
  s = advance(s, 15);
  assert.equal(s.nodes[0].status, "Ready");
  assert.deepEqual(
    s.pods.map((p) => p.id),
    ids,
  );
  assert.ok(s.pods.every((p) => p.phase === "Running"));
});
test("drain cordons a node and reschedules its managed pods", () => {
  let s = dispatch(createInitialState(), {
    type: "drain-node",
    id: "worker-01",
  });
  assert.ok(s.nodes[0].cordoned);
  s = advance(s, 7);
  assert.ok(s.pods.every((p) => p.nodeId !== "worker-01"));
  assert.equal(s.pods.length, 9);
  capacity(s);
});
test("rolling update maintains maxUnavailable=0 and active maxSurge=1", () => {
  let s = dispatch(createInitialState(), {
    type: "update-deployment",
    id: "frontend",
    image: "nginx:1.26",
  });
  for (let i = 0; i < 30; i++) {
    s = advance(s);
    const pods = managed(s);
    assert.ok(
      pods.filter((p) => p.phase === "Running").length >= 3,
      `availability lost at ${s.clock}`,
    );
    assert.ok(pods.length <= 4, "maxSurge exceeded");
    capacity(s);
  }
  assert.ok(managed(s).every((p) => p.image === "nginx:1.26"));
  assert.equal(managed(s).length, 3);
  assert.equal(s.deployments[0].updating, false);
});
test("rolling resource changes cannot bypass capacity checks", () => {
  let s = dispatch(createInitialState(), {
    type: "update-deployment",
    id: "frontend",
    cpu: 5000,
  });
  s = advance(s, 15);
  assert.equal(managed(s).filter((p) => p.phase === "Running").length, 3);
  assert.equal(managed(s).filter((p) => p.phase === "Pending").length, 1);
  capacity(s);
});
test("traffic balances ready endpoints and excludes crashing pods", () => {
  let s = createInitialState();
  const pod = managed(s)[0];
  s = dispatch(s, { type: "crash-pod", id: pod.id });
  assert.equal(endpoints(s, "svc-frontend").length, 2);
  s = dispatch(s, { type: "traffic", id: "svc-frontend", count: 10 });
  assert.ok(s.requests.every((r) => r.podId !== pod.id && r.status === 200));
  const counts = new Map<string | undefined, number>();
  s.requests.forEach((r) =>
    counts.set(r.podId, (counts.get(r.podId) ?? 0) + 1),
  );
  assert.deepEqual([...counts.values()], [5, 5]);
  s = advance(s, 6);
  assert.ok(s.pods.find((p) => p.id === pod.id)!.restarts >= 2);
  s = dispatch(s, { type: "recover-pod", id: pod.id });
  s = advance(s, 35);
  assert.equal(s.pods.find((p) => p.id === pod.id)?.phase, "Running");
  assert.equal(endpoints(s, "svc-frontend").length, 3);
});
test("no ready endpoints returns HTTP 503 without fabricating a destination", () => {
  let s = dispatch(createInitialState(), {
    type: "scale",
    id: "frontend",
    replicas: 0,
  });
  s = advance(s, 4);
  s = dispatch(s, { type: "traffic", id: "svc-frontend", count: 1 });
  assert.equal(s.requests.at(-1)?.status, 503);
  assert.equal(s.requests.at(-1)?.podId, undefined);
});
test("commands do not mutate their input and identical action sequences replay deterministically", () => {
  const source = createInitialState();
  const saved = structuredClone(source);
  const run = () => {
    let s = dispatch(source, { type: "scale", id: "api-server", replicas: 6 });
    s = advance(s, 8);
    s = dispatch(s, { type: "fail-node", id: "worker-02" });
    return advance(s, 30);
  };
  assert.deepEqual(run(), run());
  assert.deepEqual(source, saved);
});
