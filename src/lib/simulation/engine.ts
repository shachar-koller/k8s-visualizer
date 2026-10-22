import {
  Auxiliary,
  ClusterState,
  Command,
  Deployment,
  Pod,
  ScheduledEvent,
  Worker,
} from "./types";

function next(s: ClusterState) {
  return ++s.sequence;
}
function random(s: ClusterState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed.toString(36).slice(0, 5);
}
function emit(
  s: ClusterState,
  reason: string,
  message: string,
  resourceId: string,
  component: string,
  warning = false,
) {
  s.events.push({
    id: next(s),
    time: s.clock,
    type: warning ? "Warning" : "Normal",
    reason,
    message,
    resourceId,
    component,
  });
  if (s.events.length > 1000) s.events.shift();
}
function enqueue(
  s: ClusterState,
  type: ScheduledEvent["type"],
  target: string,
  delay: number,
) {
  if (!s.queue.some((q) => q.type === type && q.target === target))
    s.queue.push({ id: next(s), at: s.clock + delay, type, target });
}
export function allocation(s: ClusterState, id: string) {
  return s.pods
    .filter((p) => p.nodeId === id)
    .reduce((a, p) => ({ cpu: a.cpu + p.cpu, memory: a.memory + p.memory }), {
      cpu: 0,
      memory: 0,
    });
}
export function endpoints(s: ClusterState, serviceId: string) {
  const service = s.services.find((x) => x.id === serviceId);
  return s.pods.filter(
    (p) =>
      p.deploymentId === service?.deploymentId &&
      p.phase === "Running" &&
      s.nodes.some(
        (n) => n.id === p.nodeId && !n.offline && n.status === "Ready",
      ),
  );
}
export function podUsage(s: ClusterState, p: Pod) {
  if (
    p.phase !== "Running" ||
    s.nodes.some((n) => n.id === p.nodeId && n.offline)
  )
    return { cpu: 0, memory: 0 };
  const hash = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const load = s.requests.filter(
    (r) => r.podId === p.id && s.clock - r.time < 10,
  ).length;
  return {
    cpu: Math.round(
      p.cpu *
        Math.min(1.8, 0.36 + Math.sin(s.clock / 9 + hash) * 0.1 + load * 0.06),
    ),
    memory: Math.round(
      p.memory * (0.55 + Math.sin(s.clock / 17 + hash) * 0.06),
    ),
  };
}
export function nodeUsage(s: ClusterState, node: Worker) {
  return s.pods
    .filter((p) => p.nodeId === node.id)
    .reduce(
      (a, p) => {
        const u = podUsage(s, p);
        return { cpu: a.cpu + u.cpu, memory: a.memory + u.memory };
      },
      { cpu: 0, memory: 0 },
    );
}
function createPod(s: ClusterState, d: Deployment) {
  const suffix = random(s);
  const p: Pod = {
    id: `${d.name}-${d.revision}-${suffix}`,
    name: `${d.name}-${d.revision === 1 ? "7d8f6b9c5" : "85c7d6f4b"}-${suffix}`,
    namespace: d.namespace,
    deploymentId: d.id,
    replicaSet: `${d.name}-r${d.revision}`,
    revision: d.revision,
    image: d.image,
    phase: "Pending",
    cpu: d.cpu,
    memory: d.memory,
    createdAt: s.clock,
    restarts: 0,
    fault: false,
    containers: [
      d.name === "frontend" ? "nginx" : d.name,
      ...(d.name === "api-server" ? ["envoy-proxy"] : []),
    ],
    color: d.color,
  };
  s.pods.push(p);
  emit(
    s,
    "SuccessfulCreate",
    `ReplicaSet ${p.replicaSet} created ${p.name}. Waiting for a scheduling decision.`,
    p.id,
    "replicaset-controller",
  );
  enqueue(s, "schedule", p.id, 1);
}
function terminate(s: ClusterState, p: Pod, reason: string) {
  if (p.phase === "Terminating") return;
  p.phase = "Terminating";
  emit(s, "Killing", reason, p.id, "kubelet");
  enqueue(s, "remove", p.id, 2);
}
function reconcile(s: ClusterState) {
  for (const d of s.deployments) {
    const active = s.pods.filter(
      (p) => p.deploymentId === d.id && p.phase !== "Terminating",
    );
    const old = active.filter((p) => p.revision !== d.revision);
    if (old.length) {
      d.updating = true;
      const current = active.filter((p) => p.revision === d.revision);
      // maxSurge=1, maxUnavailable=0: never remove a healthy old replica before a new one is ready.
      if (current.length < d.replicas && active.length < d.replicas + 1)
        createPod(s, d);
      const healthy = active.filter((p) => p.phase === "Running").length;
      const victim =
        old.find((p) => p.phase !== "Running") ??
        (healthy > d.replicas ? old[old.length - 1] : undefined);
      if (victim)
        terminate(
          s,
          victim,
          "Rolling update: retiring an old revision after checking availability.",
        );
    } else {
      if (d.updating) {
        d.updating = false;
        emit(
          s,
          "RolloutComplete",
          `${d.name} now uses ${d.image}.`,
          d.id,
          "deployment-controller",
        );
      }
      for (let i = active.length; i < d.replicas; i++) createPod(s, d);
      if (active.length > d.replicas)
        active
          .slice(d.replicas)
          .forEach((p) =>
            terminate(
              s,
              p,
              "ReplicaSet is scaling down to the desired replica count.",
            ),
          );
    }
  }
  for (const p of s.pods)
    if (p.phase === "Pending") enqueue(s, "schedule", p.id, 1);
}
function processEvent(s: ClusterState, q: ScheduledEvent) {
  const p = s.pods.find((x) => x.id === q.target);
  const n = s.nodes.find((x) => x.id === q.target);
  if (q.type === "schedule" && p?.phase === "Pending") {
    const d = s.deployments.find((x) => x.id === p.deploymentId);
    const candidates = s.nodes.filter(
      (n) =>
        n.status === "Ready" &&
        !n.offline &&
        !n.cordoned &&
        (!d?.nodeSelector || n.zone === d.nodeSelector) &&
        allocation(s, n.id).cpu + p.cpu <= n.cpu &&
        allocation(s, n.id).memory + p.memory <= n.memory,
    );
    candidates.sort(
      (a, b) =>
        allocation(s, a.id).cpu / a.cpu - allocation(s, b.id).cpu / b.cpu ||
        a.id.localeCompare(b.id),
    );
    const target = candidates[0];
    if (!target) {
      const last = s.events.findLast(
        (e) => e.resourceId === p.id && e.reason === "FailedScheduling",
      );
      if (!last || s.clock - last.time >= 10)
        emit(
          s,
          "FailedScheduling",
          `No eligible node: needs ${p.cpu}m CPU and ${p.memory}Mi memory${d?.nodeSelector ? ` in ${d.nodeSelector}` : ""}. Check available capacity, node readiness, and cordons.`,
          p.id,
          "scheduler",
          true,
        );
      return;
    }
    p.nodeId = target.id;
    const subnet = `10.244.${s.nodes.indexOf(target) + 1}.`;
    let host = 10;
    while (s.pods.some((other) => other.ip === `${subnet}${host}`)) host++;
    p.ip = `${subnet}${host}`;
    p.phase = "ContainerCreating";
    emit(
      s,
      "Scheduled",
      `Assigned ${p.name} to ${target.name}; lowest requested CPU among eligible nodes.`,
      p.id,
      "scheduler",
    );
    enqueue(s, "start", p.id, 2);
  }
  if (q.type === "start" && p?.phase === "ContainerCreating") {
    const node = s.nodes.find((n) => n.id === p.nodeId);
    if (!node || node.offline || node.status !== "Ready") return;
    p.phase = "Running";
    emit(
      s,
      "Started",
      `Container ${p.containers[0]} started with image ${p.image}. Pod is ready.`,
      p.id,
      "kubelet",
    );
  }
  if (q.type === "remove" && p?.phase === "Terminating") {
    s.pods = s.pods.filter((x) => x.id !== p.id);
    emit(
      s,
      "Deleted",
      `${p.name} terminated. Allocated resources released.`,
      p.id,
      "kubelet",
    );
  }
  if (q.type === "detect-failure" && n?.offline) {
    n.status = "NotReady";
    emit(
      s,
      "NodeNotReady",
      `${n.name}: heartbeats missed for 5 simulation seconds. Eviction grace period starts.`,
      n.id,
      "node-controller",
      true,
    );
    s.pods
      .filter((p) => p.nodeId === n.id)
      .forEach((p) => {
        if (p.phase !== "Terminating") p.phase = "Unknown";
      });
    enqueue(s, "evict", n.id, 12);
  }
  if (q.type === "evict" && n?.offline) {
    s.pods
      .filter((p) => p.nodeId === n.id)
      .forEach((p) =>
        terminate(
          s,
          p,
          "Node eviction grace period elapsed. Managed replicas will be replaced.",
        ),
      );
    emit(
      s,
      "Evicted",
      `Evicting pods from ${n.name} after the failure grace period.`,
      n.id,
      "node-controller",
      true,
    );
  }
  if (q.type === "restart" && p?.phase === "CrashLoopBackOff") {
    p.restarts++;
    if (p.fault) {
      emit(
        s,
        "BackOff",
        `Container exited again. Restart ${p.restarts}; retrying with exponential backoff.`,
        p.id,
        "kubelet",
        true,
      );
      enqueue(s, "restart", p.id, Math.min(30, 2 ** p.restarts));
    } else {
      p.phase = "ContainerCreating";
      enqueue(s, "start", p.id, 2);
    }
  }
}
export function advance(input: ClusterState, ticks = 1): ClusterState {
  const s = structuredClone(input);
  for (let i = 0; i < ticks; i++) {
    s.clock++;
    const due = s.queue
      .filter((q) => q.at <= s.clock)
      .sort((a, b) => a.at - b.at || a.id - b.id);
    s.queue = s.queue.filter((q) => q.at > s.clock);
    due.forEach((q) => processEvent(s, q));
    reconcile(s);
  }
  return s;
}
export function dispatch(input: ClusterState, command: Command): ClusterState {
  const s = structuredClone(input);
  const c = command;
  const d = "id" in c ? s.deployments.find((d) => d.id === c.id) : undefined;
  const p = "id" in c ? s.pods.find((p) => p.id === c.id) : undefined;
  const n = "id" in c ? s.nodes.find((n) => n.id === c.id) : undefined;
  if (c.type === "scale" && d) {
    d.replicas = Math.max(0, Math.min(30, Math.round(c.replicas)));
    emit(
      s,
      "ScalingReplicaSet",
      `Desired replicas for ${d.name} changed to ${d.replicas}. Controller reconciliation is queued.`,
      d.id,
      "api-server",
    );
  }
  if (c.type === "delete-pod" && p)
    terminate(
      s,
      p,
      "Deletion requested through the API Server. Graceful shutdown started.",
    );
  if (c.type === "fail-node" && n && !n.offline) {
    n.offline = true;
    emit(
      s,
      "HeartbeatLost",
      `${n.name} is unreachable. The control plane has not marked it NotReady yet.`,
      n.id,
      "simulation",
      true,
    );
    enqueue(s, "detect-failure", n.id, 5);
  }
  if (c.type === "drain-node" && n) {
    n.cordoned = true;
    emit(
      s,
      "NodeCordon",
      `${n.name} is unschedulable. Evicting workloads gracefully.`,
      n.id,
      "api-server",
    );
    s.pods
      .filter((p) => p.nodeId === n.id)
      .forEach((p) =>
        terminate(
          s,
          p,
          "Node drain requested. Reschedule managed workloads on another eligible node.",
        ),
      );
  }
  if (c.type === "recover-node" && n) {
    n.offline = false;
    n.status = "Ready";
    n.cordoned = false;
    s.queue = s.queue.filter(
      (q) =>
        !(q.target === n.id && ["detect-failure", "evict"].includes(q.type)),
    );
    s.pods
      .filter(
        (p) =>
          p.nodeId === n.id &&
          (p.phase === "Unknown" || p.phase === "ContainerCreating"),
      )
      .forEach((p) => {
        p.phase = "ContainerCreating";
        enqueue(s, "start", p.id, 2);
      });
    emit(
      s,
      "NodeReady",
      `${n.name} is healthy and accepts new pods.`,
      n.id,
      "kubelet",
    );
  }
  if (c.type === "crash-pod" && p && p.phase === "Running") {
    p.phase = "CrashLoopBackOff";
    p.fault = true;
    emit(
      s,
      "BackOff",
      `Container ${p.containers[0]} exited with code 1. It is removed from ready Service endpoints.`,
      p.id,
      "kubelet",
      true,
    );
    enqueue(s, "restart", p.id, 2);
  }
  if (c.type === "recover-pod" && p && p.phase === "CrashLoopBackOff") {
    p.fault = false;
    emit(
      s,
      "FaultResolved",
      "Container fault cleared. The kubelet will retry after backoff.",
      p.id,
      "simulation",
    );
  }
  if (c.type === "add-node") {
    const i = s.nodes.length + 1;
    const id = `worker-${String(i).padStart(2, "0")}`;
    s.nodes.push({
      id,
      name: id,
      ip: `192.168.1.${10 + i}`,
      cpu: 4000,
      memory: 8192,
      status: "Ready",
      cordoned: false,
      offline: false,
      zone: `us-east-1${"abc"[(i - 1) % 3]}`,
    });
    emit(
      s,
      "RegisteredNode",
      `${id} joined with 4 CPU cores and 8 GiB allocatable memory.`,
      id,
      "node-controller",
    );
  }
  if (c.type === "create-deployment") {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(c.name) || c.name.length > 63)
      throw new Error("Use a DNS-compatible name, up to 63 characters.");
    if (
      s.deployments.some(
        (d) => d.name === c.name && d.namespace === c.namespace,
      )
    )
      throw new Error(
        "A Deployment with this name already exists in that namespace.",
      );
    if (
      !Number.isFinite(c.cpu) ||
      c.cpu <= 0 ||
      !Number.isFinite(c.memory) ||
      c.memory <= 0
    )
      throw new Error("CPU and memory requests must be positive.");
    const id = `${c.namespace}/${c.name}`;
    s.deployments.push({
      id,
      name: c.name,
      namespace: c.namespace,
      image: c.image,
      replicas: Math.min(30, Math.max(0, Math.round(c.replicas))),
      cpu: c.cpu,
      memory: c.memory,
      revision: 1,
      color: "cyan",
      updating: false,
      nodeSelector: c.nodeSelector,
    });
    emit(
      s,
      "DeploymentCreated",
      `API Server accepted ${c.name}. Desired state persisted in etcd.`,
      id,
      "api-server",
    );
  }
  if (c.type === "update-deployment" && d) {
    if (
      (c.cpu !== undefined && (!Number.isFinite(c.cpu) || c.cpu <= 0)) ||
      (c.memory !== undefined && (!Number.isFinite(c.memory) || c.memory <= 0))
    )
      throw new Error("Resource requests must be positive.");
    d.image = c.image ?? d.image;
    d.cpu = c.cpu ?? d.cpu;
    d.memory = c.memory ?? d.memory;
    d.revision++;
    d.updating = true;
    emit(
      s,
      "RollingUpdate",
      `New revision ${d.revision} for ${d.name}. maxSurge: 1, maxUnavailable: 0.`,
      d.id,
      "deployment-controller",
    );
  }
  if (c.type === "traffic") {
    const service = s.services.find((x) => x.id === c.id);
    if (service) {
      const ready = endpoints(s, service.id);
      for (let i = 0; i < Math.min(50, c.count); i++) {
        const pod = ready.length
          ? ready[service.cursor++ % ready.length]
          : undefined;
        service.requests++;
        s.requests.push({
          id: next(s),
          time: s.clock,
          serviceId: service.id,
          podId: pod?.id,
          status: pod ? 200 : 503,
          path: "/",
        });
      }
      s.requests = s.requests.slice(-200);
      emit(
        s,
        ready.length ? "TrafficRouted" : "NoReadyEndpoints",
        ready.length
          ? `${c.count} HTTP requests distributed round-robin across ${ready.length} ready endpoints for ${service.name}.`
          : `${service.name} has no ready endpoints. HTTP 503.`,
        service.id,
        "kube-proxy",
        !ready.length,
      );
    }
  }
  return s;
}
export function createInitialState(seed = 42): ClusterState {
  const auxiliary: Auxiliary[] = [
    {
      id: "ingress",
      kind: "Ingress",
      name: "kubescope-ingress",
      namespace: "production",
      data: { host: "app.kubescope.local", class: "nginx", path: "/" },
      relatedIds: ["svc-frontend"],
    },
    {
      id: "config",
      kind: "ConfigMap",
      name: "app-config",
      namespace: "production",
      data: { LOG_LEVEL: "info", API_URL: "http://api-server:8080" },
      relatedIds: ["frontend", "api-server"],
    },
    {
      id: "secret",
      kind: "Secret",
      name: "redis-credentials",
      namespace: "production",
      data: { type: "Opaque", password: "[simulated secret — redacted]" },
      relatedIds: ["redis"],
    },
    {
      id: "pvc",
      kind: "PersistentVolumeClaim",
      name: "redis-data",
      namespace: "production",
      data: {
        capacity: "10Gi",
        accessMode: "ReadWriteOnce",
        status: "Bound",
        storageClass: "standard",
      },
      relatedIds: ["pv", "redis"],
    },
    {
      id: "pv",
      kind: "PersistentVolume",
      name: "pvc-7a2b9c4e",
      data: {
        capacity: "10Gi",
        accessMode: "ReadWriteOnce",
        status: "Bound",
        reclaimPolicy: "Retain",
      },
      relatedIds: ["pvc"],
    },
  ];
  const s: ClusterState = {
    clock: 0,
    seed,
    sequence: 0,
    nodes: [1, 2, 3].map((i) => ({
      id: `worker-0${i}`,
      name: `worker-0${i}`,
      ip: `192.168.1.${10 + i}`,
      cpu: 4000,
      memory: 8192,
      status: "Ready",
      cordoned: false,
      offline: false,
      zone: `us-east-1${"abc"[i - 1]}`,
    })),
    deployments: [
      {
        id: "frontend",
        name: "frontend",
        namespace: "production",
        replicas: 3,
        image: "nginx:1.25",
        cpu: 250,
        memory: 256,
        revision: 1,
        color: "blue",
        updating: false,
      },
      {
        id: "api-server",
        name: "api-server",
        namespace: "production",
        replicas: 3,
        image: "ghcr.io/kubescope/api:2.4.0",
        cpu: 500,
        memory: 512,
        revision: 1,
        color: "purple",
        updating: false,
      },
      {
        id: "redis",
        name: "redis",
        namespace: "production",
        replicas: 1,
        image: "redis:7.2-alpine",
        cpu: 250,
        memory: 512,
        revision: 1,
        color: "orange",
        updating: false,
      },
      {
        id: "coredns",
        name: "coredns",
        namespace: "kube-system",
        replicas: 2,
        image: "registry.k8s.io/coredns/coredns:v1.11.1",
        cpu: 100,
        memory: 128,
        revision: 1,
        color: "cyan",
        updating: false,
      },
    ],
    pods: [],
    services: [
      {
        id: "svc-frontend",
        name: "frontend",
        namespace: "production",
        deploymentId: "frontend",
        type: "LoadBalancer",
        ip: "10.96.0.10",
        port: 80,
        targetPort: 80,
        requests: 0,
        cursor: 0,
      },
      {
        id: "svc-api",
        name: "api-server",
        namespace: "production",
        deploymentId: "api-server",
        type: "NodePort",
        ip: "10.96.0.20",
        port: 8080,
        targetPort: 8080,
        requests: 0,
        cursor: 0,
      },
      {
        id: "svc-redis",
        name: "redis",
        namespace: "production",
        deploymentId: "redis",
        type: "ClusterIP",
        ip: "10.96.0.30",
        port: 6379,
        targetPort: 6379,
        requests: 0,
        cursor: 0,
      },
    ],
    auxiliary,
    queue: [],
    events: [],
    requests: [],
  };
  reconcile(s);
  const ready = advance(s, 4);
  emit(
    ready,
    "ClusterReady",
    "All three worker nodes are ready. Cluster simulation initialized with seed 42.",
    "cluster",
    "simulation",
  );
  return ready;
}
