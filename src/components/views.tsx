"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Box,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  Database,
  GitBranch,
  Globe,
  GraduationCap,
  HardDrive,
  HeartPulse,
  Hexagon,
  Info,
  Layers,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  SkipForward,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { useCluster } from "@/lib/store";
import { allocation, endpoints, nodeUsage } from "@/lib/simulation/engine";
import { Selection } from "@/lib/simulation/types";
import { cn, time } from "@/lib/utils";
import { Button } from "./ui/button";
export const scenarios = [
  {
    id: "first",
    name: "Your first deployment",
    description:
      "From desired state to running containers. Follow a three-replica Nginx deployment through the control plane.",
    icon: Boxes,
    level: "Getting started",
    duration: "2 min",
    instruction:
      "Watch three new Nginx pods move from Pending to Running as the scheduler balances them across eligible nodes.",
  },
  {
    id: "healing",
    name: "Built to self-heal",
    description:
      "Delete a running pod and see the ReplicaSet controller bring your application back to its desired state.",
    icon: HeartPulse,
    level: "Fundamentals",
    duration: "2 min",
    instruction:
      "A frontend pod has been deleted. Watch its ReplicaSet create a replacement, then follow the scheduler and kubelet events.",
  },
  {
    id: "failure",
    name: "When a node goes down",
    description:
      "Lose a worker. Explore heartbeat detection, eviction delays, and workload recovery on healthy nodes.",
    icon: Server,
    level: "Intermediate",
    duration: "3 min",
    instruction:
      "Worker-01 is offline. Detection takes 5 simulation seconds; eviction follows 12 seconds later. Existing pods do not instantly move.",
  },
  {
    id: "rolling",
    name: "Updates without downtime",
    description:
      "Ship a new image version while maintaining availability with a controlled rolling update.",
    icon: RefreshCw,
    level: "Intermediate",
    duration: "3 min",
    instruction:
      "Nginx is updating to 1.26. maxSurge=1 allows one extra pod; maxUnavailable=0 keeps three ready replicas during the rollout.",
  },
  {
    id: "capacity",
    name: "There’s no room left",
    description:
      "Ask for more CPU than a node can provide and understand why a healthy cluster can have Pending pods.",
    icon: Cpu,
    level: "Intermediate",
    duration: "2 min",
    instruction:
      "Each batch-worker pod requests 5 CPU cores, but each node has only 4. Pending is correct: adding another 4-core node cannot fit a 5-core pod. Edit requests to resolve it.",
  },
  {
    id: "network",
    name: "Follow the request",
    description:
      "Send HTTP traffic through a Service and discover how ready endpoints share the load.",
    icon: Network,
    level: "Fundamentals",
    duration: "2 min",
    instruction:
      "Twelve requests were sent through frontend. Simulated round-robin selects ready endpoints; unready pods receive no traffic.",
  },
];
export function launchScenario(id: string) {
  const store = useCluster.getState();
  store.reset();
  store.setScenario(id);
  store.setPlaying(true);
  store.setNamespace("all");
  store.setSearch("");
  store.setView(id === "network" ? "Networking" : "Topology");
  store.setLayout("Physical");
  const s = useCluster.getState().cluster;
  if (id === "first") {
    store.command({
      type: "create-deployment",
      name: "nginx-demo",
      namespace: "production",
      replicas: 3,
      cpu: 250,
      memory: 256,
      image: "nginx:1.25",
    });
    store.select({ kind: "Deployment", id: "production/nginx-demo" });
  }
  if (id === "healing") {
    const p = s.pods.find((p) => p.deploymentId === "frontend")!;
    store.command({ type: "delete-pod", id: p.id });
    store.select({ kind: "Deployment", id: "frontend" });
  }
  if (id === "failure") {
    store.command({ type: "fail-node", id: "worker-01" });
    store.select({ kind: "Node", id: "worker-01" });
  }
  if (id === "rolling")
    store.command({
      type: "update-deployment",
      id: "frontend",
      image: "nginx:1.26",
    });
  if (id === "capacity") {
    store.command({
      type: "create-deployment",
      name: "batch-worker",
      namespace: "production",
      replicas: 2,
      cpu: 5000,
      memory: 4096,
      image: "busybox:1.36",
    });
    store.select({ kind: "Deployment", id: "production/batch-worker" });
  }
  if (id === "network")
    store.command({ type: "traffic", id: "svc-frontend", count: 12 });
}
export function Scenarios() {
  return (
    <div className="view-scroll scenarios-view">
      <div className="section-intro">
        <div className="intro-icon">
          <GraduationCap size={27} />
        </div>
        <h2>A little curiosity. A lot of clarity.</h2>
        <p>
          Learn Kubernetes by making things happen. Break a pod, take down a
          node,
          <br className="desktop-only" /> or ship an update. Your cluster is a
          safe place to experiment.
        </p>
      </div>
      <div className="scenario-grid">
        {scenarios.map((s, i) => (
          <button
            className="scenario-card"
            key={s.id}
            onClick={() => launchScenario(s.id)}
          >
            <div className="scenario-card-top">
              <span className={`scenario-icon scenario-color-${i}`}>
                <s.icon size={23} />
              </span>
              <span>{s.duration}</span>
            </div>
            <small>{s.level}</small>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <div className="scenario-start">
              Start scenario
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>
      <div className="info-note">
        <ShieldCheck size={18} />
        <span>
          Every scenario runs locally in your browser. Start a scenario to reset
          the cluster to a known, reproducible state.
        </span>
      </div>
    </div>
  );
}
export function ScenarioBanner() {
  const { scenario, setScenario, playing, setPlaying, step } = useCluster();
  const s = scenarios.find((s) => s.id === scenario);
  if (!s) return null;
  return (
    <div className="scenario-banner">
      <s.icon size={22} />
      <div>
        <strong>{s.name}</strong>
        <p>{s.instruction}</p>
      </div>
      <button
        className="icon-btn"
        aria-label={playing ? "Pause scenario" : "Play scenario"}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        className="icon-btn"
        aria-label="Step scenario"
        onClick={() => {
          setPlaying(false);
          step();
        }}
      >
        <SkipForward size={16} />
      </button>
      <button
        className="icon-btn"
        aria-label="Restart scenario"
        onClick={() => launchScenario(s.id)}
      >
        <RotateCcw size={16} />
      </button>
      <button className="link" onClick={() => setScenario(null)}>
        Exit
      </button>
    </div>
  );
}
export function NetworkingToolbar() {
  const { cluster, command } = useCluster();
  const [service, setService] = useState("svc-frontend");
  const [count, setCount] = useState(1);
  const svc = cluster.services.find((v) => v.id === service)!;
  const last = cluster.requests.filter((r) => r.serviceId === service).at(-1);
  const pod = cluster.pods.find((p) => p.id === last?.podId);
  return (
    <div className="network-panel">
      <div className="network-request">
        <span className="method">GET</span>
        <select
          aria-label="Target Service"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          {cluster.services.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}.{v.namespace}.svc.cluster.local
            </option>
          ))}
        </select>
        <select
          aria-label="Request count"
          value={count}
          onChange={(e) => setCount(+e.target.value)}
        >
          {[1, 10, 30].map((n) => (
            <option key={n} value={n}>
              {n} request{n !== 1 && "s"}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() => command({ type: "traffic", id: service, count })}
        >
          <Zap size={13} /> Send request
        </Button>
      </div>
      <div className="network-explanation">
        <span>
          <i className="status-dot" />
          {endpoints(cluster, service).length} ready endpoints
        </span>
        <span>DNS → {svc.ip}</span>
        {last ? (
          <span className={last.status === 200 ? "text-green" : "text-red"}>
            {last.status}{" "}
            {pod ? `→ ${pod.name} · round-robin` : "No ready endpoints"}
          </span>
        ) : (
          <span>Send a request to trace its route</span>
        )}
      </div>
    </div>
  );
}
const planeSteps = [
  {
    title: "Request received",
    component: "API Server",
    icon: Globe,
    text: "Your Deployment specification reaches the API Server, the front door to the cluster. Authentication and admission are abstracted in this simulation.",
  },
  {
    title: "Desired state persisted",
    component: "etcd",
    icon: Database,
    text: "The desired state is stored. Kubernetes now knows you want three Nginx replicas, even though no containers are running yet.",
  },
  {
    title: "Controller reconciles",
    component: "Controller Manager",
    icon: RefreshCw,
    text: "The Deployment controller observes the desired state. Its ReplicaSet reconciles the difference between desired and observed replicas.",
  },
  {
    title: "Pod objects created",
    component: "ReplicaSet",
    icon: Boxes,
    text: "The ReplicaSet creates three Pod objects. They are Pending and have no assigned node. A Pod object is a request, not a running container.",
  },
  {
    title: "Scheduler assigns nodes",
    component: "Scheduler",
    icon: GitBranch,
    text: "The scheduler filters out unavailable nodes and checks CPU and memory requests. It selects the eligible node with the lowest requested CPU fraction.",
  },
  {
    title: "Containers start",
    component: "kubelet + runtime",
    icon: Box,
    text: "Each node’s kubelet asks the container runtime to start the assigned containers. Image pulling is represented by a brief ContainerCreating phase.",
  },
  {
    title: "Ready status reported",
    component: "API Server",
    icon: CheckCircle2,
    text: "Pod status is reported back. All three containers are Running. Service networking can now use the ready pods as endpoints.",
  },
];
export function ControlPlane() {
  const { cluster, command, setPlaying, step, select, reset } = useCluster();
  const [stage, setStage] = useState(0);
  const [auto, setAuto] = useState(false);
  const [started, setStarted] = useState(false);
  const [demoId, setDemoId] = useState("");
  function next() {
    setPlaying(false);
    if (!started) {
      setStarted(true);
      setStage(0);
      return;
    }
    const i = Math.min(6, stage + 1);
    if (i === 1) {
      const name = `nginx-walkthrough-${cluster.sequence}`;
      command({
        type: "create-deployment",
        name,
        namespace: "production",
        replicas: 3,
        cpu: 250,
        memory: 256,
        image: "nginx:1.25",
      });
      setDemoId(`production/${name}`);
      select({ kind: "Deployment", id: `production/${name}` });
    }
    if (i === 2) step();
    if (i === 4) step();
    if (i === 5) {
      step();
      step();
    }
    setStage(i);
    if (i === 6) setAuto(false);
  }
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(next, 1700);
    return () => clearTimeout(timer);
  });
  const current = planeSteps[stage];
  return (
    <div className="view-scroll plane-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Behind the abstraction</span>
          <h2>Meet your control plane.</h2>
          <p>One request. A coordinated system bringing it to life.</p>
        </div>
        <span className="badge">
          <Radio size={12} /> Interactive walkthrough
        </span>
      </div>
      <div className="plane-diagram">
        <div className="plane-boundary">
          <div className="boundary-label">
            <Hexagon size={14} /> Control plane
          </div>
          <div className="plane-components">
            {[
              { name: "API Server", icon: Globe, stages: [0, 6] },
              { name: "etcd", icon: Database, stages: [1] },
              { name: "Controller Manager", icon: RefreshCw, stages: [2, 3] },
              { name: "Scheduler", icon: GitBranch, stages: [4] },
            ].map((c, i) => (
              <div className="plane-component-wrap" key={c.name}>
                <button
                  className={cn(
                    "plane-component",
                    started && c.stages.includes(stage) && "active",
                  )}
                  onClick={() => select({ kind: "ControlPlane", id: c.name })}
                >
                  <c.icon size={26} />
                  <strong>{c.name}</strong>
                  <span>
                    {
                      [
                        "Cluster gateway",
                        "Source of truth",
                        "Reconciliation",
                        "Pod placement",
                      ][i]
                    }
                  </span>
                </button>
                {i < 3 && (
                  <span
                    className={cn(
                      "plane-connector",
                      started && stage >= i && "flowing",
                    )}
                  >
                    <ArrowRight size={18} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="plane-vertical">
          <span className={started && stage >= 4 ? "flowing" : ""} />
          <small>Watch desired state · report observed state</small>
          <ArrowDown size={18} />
        </div>
        <div className="plane-workers">
          {cluster.nodes.slice(0, 3).map((n) => (
            <button
              key={n.id}
              className={cn("plane-worker", started && stage >= 5 && "active")}
              onClick={() => select({ kind: "Node", id: n.id })}
            >
              <div>
                <Server size={17} />
                <strong>{n.name}</strong>
                <i className={cn("status-dot", n.offline && "red")} />
              </div>
              <span>
                <Box size={13} /> kubelet <ArrowRight size={12} /> containerd
              </span>
              <span>
                <Network size={13} /> kube-proxy / Service networking
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="walkthrough">
        <div className="walkthrough-progress">
          {planeSteps.map((_, i) => (
            <span
              className={cn(
                started && i <= stage && "complete",
                started && i === stage && "current",
              )}
              key={i}
            />
          ))}
        </div>
        <div className="walkthrough-description">
          <span className="step-number">{stage + 1}</span>
          <div>
            <small>
              STEP {stage + 1} OF 7 · {current.component}
            </small>
            <h3>{current.title}</h3>
            <p>{current.text}</p>
          </div>
        </div>
        <div className="walkthrough-controls">
          <span>
            {demoId
              ? `${cluster.pods.filter((p) => p.deploymentId === demoId && p.phase === "Running").length}/3 pods running`
              : "Creates a real Deployment in the simulated cluster"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setPlaying(false);
              setStarted(false);
              setStage(0);
              setAuto(false);
              setDemoId("");
            }}
          >
            <RotateCcw size={14} />
            Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!started) next();
              setAuto(!auto);
            }}
            disabled={stage === 6}
          >
            {auto ? <Pause size={14} /> : <Play size={14} />}{" "}
            {auto ? "Pause" : "Auto-play"}
          </Button>
          <Button size="sm" onClick={next} disabled={stage === 6}>
            <SkipForward size={14} />
            {started ? "Next step" : "Begin walkthrough"}
          </Button>
        </div>
      </div>
      <div className="info-note">
        <Info size={17} />
        <span>
          Steps share the simulation state. Multiple controllers run
          concurrently in real Kubernetes; this walkthrough pauses between
          stages to make their responsibilities visible.
        </span>
      </div>
    </div>
  );
}
export function Overview() {
  const { cluster, history, select, setView } = useCluster();
  const totalCpu = cluster.nodes.reduce((a, n) => a + n.cpu, 0);
  const totalMem = cluster.nodes.reduce((a, n) => a + n.memory, 0);
  const used = cluster.nodes.reduce(
    (a, n) => {
      const u = nodeUsage(cluster, n);
      return { cpu: a.cpu + u.cpu, memory: a.memory + u.memory };
    },
    { cpu: 0, memory: 0 },
  );
  const requested = cluster.nodes.reduce(
    (a, n) => {
      const u = allocation(cluster, n.id);
      return { cpu: a.cpu + u.cpu, memory: a.memory + u.memory };
    },
    { cpu: 0, memory: 0 },
  );
  const series = [...history.slice(-29), cluster];
  return (
    <div className="view-scroll overview-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">The big picture</span>
          <h2>Your cluster, at a glance.</h2>
          <p>A live view of your simulated infrastructure.</p>
        </div>
        <Button variant="secondary" onClick={() => setView("Topology")}>
          <Workflow size={15} /> Explore topology
        </Button>
      </div>
      <div className="monitor-grid">
        {[
          {
            name: "CPU utilization",
            value: `${(used.cpu / 1000).toFixed(2)}`,
            unit: `/ ${totalCpu / 1000} cores`,
            percent: (used.cpu / totalCpu) * 100,
            requested: (requested.cpu / totalCpu) * 100,
            field: "cpu" as const,
          },
          {
            name: "Memory usage",
            value: `${(used.memory / 1024).toFixed(2)}`,
            unit: `/ ${totalMem / 1024} GiB`,
            percent: (used.memory / totalMem) * 100,
            requested: (requested.memory / totalMem) * 100,
            field: "memory" as const,
          },
        ].map((metric) => (
          <div className="monitor-card" key={metric.name}>
            <h3>
              {metric.name}
              <span>Last {series.length} ticks</span>
            </h3>
            <div className="monitor-value">
              {metric.value}
              <small>{metric.unit}</small>
              <span>{metric.percent.toFixed(1)}%</span>
            </div>
            <svg
              viewBox="0 0 500 90"
              role="img"
              aria-label={`${metric.name} history`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id={`fill-${metric.field}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#5588ef" stopOpacity=".25" />
                  <stop offset="100%" stopColor="#5588ef" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 90 ${series.map((s, i) => `L ${(i * 500) / Math.max(1, series.length - 1)} ${90 - (s.nodes.reduce((a, n) => a + nodeUsage(s, n)[metric.field], 0) / (metric.field === "cpu" ? totalCpu : totalMem)) * 300}`).join(" ")} L 500 90 Z`}
                fill={`url(#fill-${metric.field})`}
              />
              <polyline
                points={series
                  .map(
                    (s, i) =>
                      `${(i * 500) / Math.max(1, series.length - 1)},${90 - (s.nodes.reduce((a, n) => a + nodeUsage(s, n)[metric.field], 0) / (metric.field === "cpu" ? totalCpu : totalMem)) * 300}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="#6797ff"
                strokeWidth="2"
              />
            </svg>
            <div className="monitor-legend">
              <span>
                <i className="status-dot blue" />
                Usage {metric.percent.toFixed(1)}%
              </span>
              <span>Requested {metric.requested.toFixed(1)}%</span>
              <span>Allocatable 100%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="data-card">
        <div className="data-card-title">
          <h3>Worker nodes</h3>
          <span>
            {cluster.nodes.filter((n) => n.status === "Ready").length} ready /{" "}
            {cluster.nodes.length} total
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Status</th>
              <th>Pods</th>
              <th>CPU / allocatable</th>
              <th>Memory / allocatable</th>
            </tr>
          </thead>
          <tbody>
            {cluster.nodes.map((n) => {
              const u = nodeUsage(cluster, n);
              return (
                <tr
                  key={n.id}
                  onClick={() => select({ kind: "Node", id: n.id })}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && select({ kind: "Node", id: n.id })
                  }
                >
                  <td>
                    <span className="table-resource">
                      <Server size={15} />
                      {n.name}
                    </span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "badge",
                        n.status === "Ready" ? "badge-green" : "badge-red",
                      )}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td>
                    {cluster.pods.filter((p) => p.nodeId === n.id).length}
                  </td>
                  <td>
                    {u.cpu} / {n.cpu}m
                    <div className="table-meter">
                      <i style={{ width: `${(u.cpu / n.cpu) * 100}%` }} />
                    </div>
                  </td>
                  <td>
                    {u.memory} / {n.memory}Mi
                    <div className="table-meter purple">
                      <i style={{ width: `${(u.memory / n.memory) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="data-card">
        <div className="data-card-title">
          <h3>Deployment availability</h3>
          <span>{cluster.deployments.length} deployments</span>
        </div>
        <div className="availability-grid">
          {cluster.deployments.map((d) => {
            const ready = cluster.pods.filter(
              (p) => p.deploymentId === d.id && p.phase === "Running",
            ).length;
            return (
              <button
                key={d.id}
                onClick={() => select({ kind: "Deployment", id: d.id })}
              >
                <Boxes size={19} />
                <div>
                  <strong>{d.name}</strong>
                  <small>{d.namespace}</small>
                </div>
                <span
                  className={ready >= d.replicas ? "text-green" : "text-yellow"}
                >
                  {ready}/{d.replicas}
                  <small>ready</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function Resources() {
  const { cluster, namespace, search, select } = useCluster();
  const [kind, setKind] = useState("All resources");
  const rows: {
    selection: Selection;
    name: string;
    namespace?: string;
    status: string;
    detail: string;
  }[] = [
    ...cluster.deployments.map((d) => ({
      selection: { kind: "Deployment" as const, id: d.id },
      name: d.name,
      namespace: d.namespace,
      status: d.updating ? "Updating" : "Active",
      detail: `${d.replicas} replicas · ${d.image}`,
    })),
    ...cluster.pods.map((p) => ({
      selection: { kind: "Pod" as const, id: p.id },
      name: p.name,
      namespace: p.namespace,
      status: p.phase,
      detail: p.nodeId ?? "Awaiting scheduling",
    })),
    ...cluster.services.map((s) => ({
      selection: { kind: "Service" as const, id: s.id },
      name: s.name,
      namespace: s.namespace,
      status: "Active",
      detail: `${s.type} · ${s.ip}:${s.port}`,
    })),
    ...cluster.nodes.map((n) => ({
      selection: { kind: "Node" as const, id: n.id },
      name: n.name,
      status: n.status,
      detail: `${n.cpu / 1000} CPU · ${n.memory / 1024} GiB`,
    })),
    ...cluster.auxiliary.map((a) => ({
      selection: { kind: a.kind, id: a.id },
      name: a.name,
      namespace: a.namespace,
      status: a.data.status ?? "Active",
      detail: Object.values(a.data).slice(0, 2).join(" · "),
    })),
    ...[...new Set(cluster.pods.map((p) => p.replicaSet).filter(Boolean))].map(
      (id) => ({
        selection: { kind: "ReplicaSet" as const, id: id! },
        name: id!,
        namespace: cluster.pods.find((p) => p.replicaSet === id)?.namespace,
        status: "Active",
        detail: `${cluster.pods.filter((p) => p.replicaSet === id).length} pods`,
      }),
    ),
    ...[
      ...new Set([
        "default",
        "production",
        "kube-system",
        ...cluster.deployments.map((d) => d.namespace),
      ]),
    ].map((id) => ({
      selection: { kind: "Namespace" as const, id },
      name: id,
      namespace: id,
      status: "Active",
      detail: "Namespace",
    })),
  ];
  const filtered = rows.filter(
    (r) =>
      (kind === "All resources" || r.selection.kind === kind) &&
      (namespace === "all" || r.namespace === namespace) &&
      r.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="view-scroll resources-view">
      <div className="view-heading">
        <div>
          <h2>Cluster resources</h2>
          <p>Every object. One source of truth.</p>
        </div>
        <select
          aria-label="Resource kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {["All resources", ...new Set(rows.map((r) => r.selection.kind))].map(
            (k) => (
              <option key={k}>{k}</option>
            ),
          )}
        </select>
      </div>
      <div className="data-card">
        <div className="data-card-title">
          <h3>{kind}</h3>
          <span>{filtered.length} objects</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Namespace</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={`${r.selection.kind}-${r.selection.id}`}
                tabIndex={0}
                onClick={() => select(r.selection)}
                onKeyDown={(e) => e.key === "Enter" && select(r.selection)}
              >
                <td>
                  <span className="table-resource">
                    <Box size={14} />
                    {r.name}
                  </span>
                </td>
                <td>{r.selection.kind}</td>
                <td>{r.namespace ?? "—"}</td>
                <td>
                  <span
                    className={cn(
                      "badge",
                      ["Running", "Ready", "Active", "Bound"].includes(r.status)
                        ? "badge-green"
                        : "badge-yellow",
                    )}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="muted">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-state">
            <Box size={25} />
            <h3>No matching resources</h3>
            <p>Try a different namespace, kind, or search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
export function Settings() {
  const { speed, setSpeed, cluster, reset, notify } = useCluster();
  return (
    <div className="view-scroll settings-view">
      <div className="view-heading">
        <div>
          <h2>Your simulation workspace</h2>
          <p>Predictable by design. Safe to experiment.</p>
        </div>
      </div>
      <section className="settings-card">
        <h3>
          <Settings2 size={18} /> Simulation
        </h3>
        <div className="setting-row">
          <div>
            <strong>Playback speed</strong>
            <p>Real seconds per simulation tick: {1 / speed}</p>
          </div>
          <select
            aria-label="Simulation speed setting"
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
          >
            {[0.5, 1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>
            <strong>Deterministic scenarios</strong>
            <p>
              Initial seed: 42. Same actions at the same ticks produce the same
              state.
            </p>
          </div>
          <span className="badge badge-green">Enabled</span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Reset workspace</strong>
            <p>
              Restore the original three-node cluster and clear event history.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              notify("Cluster reset to its initial state.");
            }}
          >
            <RotateCcw size={14} />
            Reset
          </Button>
        </div>
      </section>
      <section className="settings-card">
        <h3>
          <Info size={18} /> What this simulation models
        </h3>
        <p>
          Desired and observed replicas, a discrete event queue, aggregate pod
          resource requests, capacity-aware scheduling, ready Service endpoints,
          delayed node eviction, container backoff, and rolling updates.
        </p>
        <p>
          Time is compressed: node failure detection takes 5 ticks and eviction
          waits another 12 ticks. Image pulls take 2 ticks. Real Kubernetes
          timing depends on cluster configuration. Services use deterministic
          round-robin here; real kube-proxy behavior varies by mode.
        </p>
        <p>
          Network policies, DNS caching, volume attachment scheduling,
          admission, limits, real container execution, and full Kubernetes
          controller semantics are not modeled. Storage objects illustrate
          relationships.
        </p>
      </section>
      <section className="settings-card">
        <h3>
          <ShieldCheck size={18} /> Live clusters{" "}
          <span className="badge">Planned</span>
        </h3>
        <p>
          The provider interface reserves read-only resource snapshots and watch
          subscriptions. A future server-side adapter will hold Kubernetes
          credentials; kubeconfigs and API tokens must never be sent to the
          browser.
        </p>
        <div className="info-note">
          <Info size={16} />
          <span>
            This workspace is running a browser-local simulation. No live
            cluster is connected.
          </span>
        </div>
      </section>
    </div>
  );
}
