"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Box,
  Boxes,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Hexagon,
  Layers,
  LockKeyhole,
  Network,
  Server,
  Settings2,
  Workflow,
  Zap,
} from "lucide-react";
import { useCluster, type Layout } from "@/lib/store";
import { allocation, endpoints, nodeUsage } from "@/lib/simulation/engine";
import { ClusterState, Selection } from "@/lib/simulation/types";
import { cn } from "@/lib/utils";
type Data = {
  name: string;
  subtitle?: string;
  kind: string;
  color?: string;
  status?: string;
  selection: Selection;
  cpu?: number;
  memory?: number;
  podCount?: number;
  collapsed?: boolean;
  onCollapse?: () => void;
  containers?: string[];
  ip?: string;
  detail?: string;
  highlighted?: boolean;
  width?: number;
};
type ResourceNode = Node<Data>;
const icons: Record<string, typeof Box> = {
  Pod: Box,
  Node: Server,
  ControlPlane: Hexagon,
  Service: Network,
  Ingress: Globe,
  Deployment: Boxes,
  ReplicaSet: Layers,
  PersistentVolume: HardDrive,
  PersistentVolumeClaim: Database,
  ConfigMap: Settings2,
  Secret: LockKeyhole,
  Endpoints: Workflow,
  Cluster: Globe,
  Namespace: Layers,
};
function Ports() {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
function ResourceCard({ data, selected }: NodeProps<ResourceNode>) {
  const Icon = icons[data.kind] ?? Box;
  return (
    <div
      className={cn(
        "graph-resource",
        `tone-${data.color ?? "blue"}`,
        selected && "is-selected",
        data.highlighted && "packet-hit",
      )}
    >
      <Ports />
      <div className="resource-icon">
        <Icon size={18} />
      </div>
      <div className="resource-card-content">
        <div className="resource-kind">
          {data.kind === "ControlPlane" ? "Control plane" : data.kind}
        </div>
        <strong>{data.name}</strong>
        <small>{data.subtitle}</small>
      </div>
      <span className={cn("status-dot", data.status === "NotReady" && "red")} />
    </div>
  );
}
function PodCard({ data, selected }: NodeProps<ResourceNode>) {
  const healthy = data.status === "Running";
  return (
    <div
      className={cn(
        "graph-pod",
        `tone-${data.color}`,
        selected && "is-selected",
        data.highlighted && "packet-hit",
        data.status === "Terminating" && "terminating",
      )}
    >
      <Ports />
      <div className="pod-top">
        <Box size={14} />
        <strong>{data.name}</strong>
        <span
          className={cn(
            "status-dot",
            !healthy &&
              (data.status === "CrashLoopBackOff" || data.status === "Unknown"
                ? "red"
                : "yellow"),
          )}
        />
      </div>
      <div className="pod-bottom">
        <span className="container-boxes">
          {data.containers?.map((name) => (
            <span key={name} title={`Container: ${name}`}>
              <Box size={10} />
            </span>
          ))}
        </span>
        <span>
          {healthy ? data.containers?.length : 0}/{data.containers?.length}{" "}
          containers
        </span>
        <span className={healthy ? "text-green" : "text-yellow"}>
          {data.status}
        </span>
      </div>
    </div>
  );
}
function WorkerCard({ data, selected }: NodeProps<ResourceNode>) {
  return (
    <div
      className={cn(
        "graph-worker",
        selected && "is-selected",
        data.status === "NotReady" && "worker-failed",
      )}
    >
      <Ports />
      <div className="worker-heading">
        <span className="worker-icon">
          <Server size={18} />
        </span>
        <div>
          <strong>{data.name}</strong>
          <small>{data.ip}</small>
        </div>
        <button
          className="nodrag collapse-button"
          onClick={(e) => {
            e.stopPropagation();
            data.onCollapse?.();
          }}
          aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${data.name}`}
        >
          {data.collapsed ? (
            <ChevronRight size={15} />
          ) : (
            <ChevronDown size={15} />
          )}
        </button>
      </div>
      <div className="worker-stats">
        <span>
          <span
            className={cn("status-dot", data.status !== "Ready" && "red")}
          />
          {data.status}
        </span>
        <span>
          <Cpu size={11} />
          {data.cpu}%
        </span>
        <span>
          <HardDrive size={11} />
          {data.memory}%
        </span>
      </div>
      {!data.collapsed && (
        <>
          <div className="namespace-label">
            <Layers size={11} />
            {data.detail}
            <span>{data.podCount} pods</span>
          </div>
          <div className="worker-foot">
            <span>4 vCPU</span>
            <span>8 GiB RAM</span>
            <span className="worker-runtime">containerd</span>
          </div>
        </>
      )}
    </div>
  );
}
const nodeTypes = { resource: ResourceCard, pod: PodCard, worker: WorkerCard };
function ActivityEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath(props);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        label={props.label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={props.labelStyle}
        labelBgStyle={props.labelBgStyle}
      />
      {props.animated && (
        <circle className="packet-marker" r="3" fill="#9ac7ff">
          <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
}
const edgeTypes = { activity: ActivityEdge };
function graph(
  s: ClusterState,
  layout: Layout,
  namespace: string,
  search: string,
  collapsed: string[],
  toggle: (id: string) => void,
): { nodes: ResourceNode[]; edges: Edge[] } {
  const nodes: ResourceNode[] = [];
  const edges: Edge[] = [];
  const visible = (p: { namespace?: string; name: string }) =>
    (namespace === "all" || p.namespace === namespace) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()));
  const add = (
    id: string,
    name: string,
    kind: Selection["kind"],
    x: number,
    y: number,
    subtitle = "",
    color = "blue",
    selectionId = id,
  ) => {
    nodes.push({
      id,
      type: "resource",
      position: { x, y },
      data: {
        name,
        kind,
        selection: { kind, id: selectionId },
        subtitle,
        color,
      },
      style: { width: 242 },
    });
  };
  const connect = (
    source: string,
    target: string,
    animated = false,
    color = "#394764",
    label?: string,
  ) =>
    edges.push({
      id: `${source}-${target}`,
      source,
      target,
      type: "activity",
      animated,
      label,
      style: { stroke: color, strokeWidth: 1.4 },
      labelStyle: { fill: "#8894ab", fontSize: 10 },
      labelBgStyle: { fill: "#11141c" },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    });
  const podNode = (
    p: ClusterState["pods"][number],
    x: number,
    y: number,
    parentId?: string,
  ) =>
    nodes.push({
      id: p.id,
      type: "pod",
      parentId,
      extent: parentId ? "parent" : undefined,
      position: { x, y },
      data: {
        name: p.name,
        kind: "Pod",
        color: p.color,
        status: p.phase,
        selection: { kind: "Pod", id: p.id },
        containers: p.containers,
        highlighted: s.requests.some(
          (r) => r.podId === p.id && s.clock - r.time <= 2,
        ),
      },
      style: { width: 228 },
    });
  if (layout === "Physical") {
    add(
      "control",
      "Control plane",
      "ControlPlane",
      300,
      0,
      "API server · Scheduler · etcd",
      "blue",
      "control",
    );
    s.services.filter(visible).forEach((service, i) => {
      add(
        service.id,
        service.name,
        "Service",
        i * 286 + 4,
        94,
        `${service.ip}:${service.port}  ·  ${service.type}`,
        s.deployments.find((d) => d.id === service.deploymentId)?.color,
      );
      connect("control", service.id, false, "#344564");
    });
    s.nodes.forEach((n, i) => {
      const pods = s.pods.filter((p) => p.nodeId === n.id && visible(p));
      const folded = collapsed.includes(n.id);
      const usage = nodeUsage(s, n);
      nodes.push({
        id: n.id,
        type: "worker",
        position: { x: (i % 3) * 286, y: 202 + Math.floor(i / 3) * 390 },
        data: {
          kind: "Node",
          name: n.name,
          selection: { kind: "Node", id: n.id },
          status:
            n.offline && n.status === "Ready"
              ? "Unreachable"
              : n.cordoned
                ? "Cordoned"
                : n.status,
          cpu: Math.round((usage.cpu / n.cpu) * 100),
          memory: Math.round((usage.memory / n.memory) * 100),
          ip: n.ip,
          podCount: pods.length,
          collapsed: folded,
          onCollapse: () => toggle(n.id),
          detail: namespace === "all" ? "production / kube-system" : namespace,
        },
        style: {
          width: 258,
          height: folded ? 96 : Math.max(305, pods.length * 58 + 131),
        },
        zIndex: 0,
      });
      if (!folded) pods.forEach((p, j) => podNode(p, 15, 105 + j * 58, n.id));
      s.services.filter(visible).forEach((service) => {
        if (pods.some((p) => p.deploymentId === service.deploymentId))
          connect(
            service.id,
            n.id,
            s.requests.some(
              (r) => r.serviceId === service.id && s.clock - r.time < 3,
            ),
            service.deploymentId === "frontend" ? "#3f65a2" : "#424a63",
          );
      });
    });
    s.pods
      .filter((p) => !p.nodeId && visible(p))
      .forEach((p, i) =>
        podNode(
          p,
          (i % 3) * 286 + 15,
          Math.max(570, 202 + Math.ceil(s.nodes.length / 3) * 390) +
            Math.floor(i / 3) * 70,
        ),
      );
  } else if (layout === "Logical") {
    const deps = s.deployments.filter(visible);
    deps.forEach((d, i) => {
      const x = i * 278;
      add(
        d.id,
        d.name,
        "Deployment",
        x,
        0,
        `${d.replicas} desired replicas · revision ${d.revision}`,
        d.color,
      );
      const revisions = [
        ...new Set(
          s.pods.filter((p) => p.deploymentId === d.id).map((p) => p.revision),
        ),
      ];
      if (!revisions.length) revisions.push(d.revision);
      revisions.forEach((rev, k) => {
        const rs = `${d.name}-r${rev}`;
        add(
          rs,
          rs,
          "ReplicaSet",
          x + k * 12,
          130 + k * 100,
          `Owner: ${d.name}`,
          d.color,
        );
        connect(d.id, rs, d.updating);
      });
      s.pods
        .filter((p) => p.deploymentId === d.id)
        .forEach((p, j) => {
          podNode(p, x + 7, 280 + j * 90);
          connect(p.replicaSet!, p.id, p.phase === "ContainerCreating");
        });
    });
  } else if (layout === "Networking") {
    add(
      "client",
      "External client",
      "Cluster",
      280,
      0,
      "HTTP GET app.kubescope.local",
      "cyan",
      "cluster",
    );
    add(
      "ingress",
      "kubescope-ingress",
      "Ingress",
      280,
      126,
      "nginx · app.kubescope.local",
    );
    connect(
      "client",
      "ingress",
      s.requests.some((r) => s.clock - r.time <= 2),
      "#4e8cda",
      "HTTP :80",
    );
    s.services.filter(visible).forEach((service, i) => {
      const x = i * 290;
      const ready = endpoints(s, service.id);
      add(
        service.id,
        service.name,
        "Service",
        x,
        266,
        `${service.ip}:${service.port} · ${service.type}`,
      );
      if (i === 0)
        connect(
          "ingress",
          service.id,
          s.requests.some(
            (r) => r.serviceId === service.id && s.clock - r.time <= 2,
          ),
        );
      else
        connect(
          s.services[i - 1].id,
          service.id,
          false,
          "#3d526d",
          "Cluster DNS",
        );
      add(
        `ep-${service.id}`,
        `${service.name} endpoints`,
        "Endpoints",
        x,
        400,
        `${ready.length} ready · round-robin`,
        "cyan",
        service.id,
      );
      connect(
        service.id,
        `ep-${service.id}`,
        s.requests.some(
          (r) => r.serviceId === service.id && s.clock - r.time < 3,
        ),
        "#3b8493",
      );
      s.pods
        .filter((p) => p.deploymentId === service.deploymentId && visible(p))
        .forEach((p, j) => {
          podNode(p, x + 7, 540 + j * 95);
          connect(
            `ep-${service.id}`,
            p.id,
            s.requests.some((r) => r.podId === p.id && s.clock - r.time <= 2),
            p.phase === "Running" ? "#3b8493" : "#5a3c45",
            p.ip,
          );
        });
    });
  } else {
    add(
      "pv",
      "pvc-7a2b9c4e",
      "PersistentVolume",
      280,
      0,
      "10 GiB · standard · Bound",
      "cyan",
    );
    add(
      "pvc",
      "redis-data",
      "PersistentVolumeClaim",
      280,
      150,
      "ReadWriteOnce · 10 GiB",
      "cyan",
    );
    add(
      "redis",
      "redis",
      "Deployment",
      280,
      300,
      "Volume mount: /data",
      "orange",
    );
    connect("pv", "pvc", false, "#4d8587", "Bound");
    connect("pvc", "redis", false, "#4d8587", "Mounted");
    s.pods
      .filter((p) => p.deploymentId === "redis" && visible(p))
      .forEach((p, i) => {
        podNode(p, 287, 450 + i * 90);
        connect("redis", p.id);
      });
    add(
      "config",
      "app-config",
      "ConfigMap",
      0,
      150,
      "LOG_LEVEL · API_URL",
      "purple",
    );
    add(
      "secret",
      "redis-credentials",
      "Secret",
      560,
      150,
      "Opaque · simulated data",
      "orange",
    );
    connect("secret", "redis");
    connect("config", "redis");
  }
  return { nodes, edges };
}
function AutoFit({
  signature,
  container,
}: {
  signature: string;
  container: React.RefObject<HTMLDivElement | null>;
}) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(
      () => void fitView({ padding: 0.1, duration: 250 }),
      80,
    );
    return () => clearTimeout(timer);
  }, [signature, initialized, fitView]);
  useEffect(() => {
    if (!container.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void fitView({ padding: 0.1, duration: 250 }),
        100,
      );
    });
    observer.observe(container.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [container, fitView]);
  return null;
}
export function Topology({ mode }: { mode: Layout }) {
  const container = useRef<HTMLDivElement>(null);
  const { cluster, select, namespace, search } = useCluster();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggle = useCallback(
    (id: string) =>
      setCollapsed((s) =>
        s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
      ),
    [],
  );
  const computed = useMemo(
    () => graph(cluster, mode, namespace, search, collapsed, toggle),
    [cluster, mode, namespace, search, collapsed, toggle],
  );
  const [nodes, setNodes] = useState<ResourceNode[]>(computed.nodes);
  useEffect(
    () =>
      setNodes((previous) =>
        computed.nodes.map((n) => {
          const prev = previous.find((p) => p.id === n.id);
          return {
            ...n,
            position: n.parentId ? n.position : (prev?.position ?? n.position),
            selected: prev?.selected,
          };
        }),
      ),
    [computed],
  );
  const changes = useCallback(
    (changes: NodeChange<ResourceNode>[]) =>
      setNodes((n) => applyNodeChanges(changes, n)),
    [],
  );
  return (
    <div className="topology-canvas" ref={container}>
      <div className="canvas-label">
        <span className="status-dot" /> <strong>production-cluster</strong>
        <span> / </span>
        <span>{mode.toLowerCase()} topology</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={computed.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={changes}
        onNodeClick={(_, n) => select(n.data.selection)}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        deleteKeyCode={null}
        colorMode="dark"
      >
        <AutoFit
          signature={`${computed.nodes.length}:${collapsed.join()}:${namespace}:${search}`}
          container={container}
        />
        <Background
          variant={BackgroundVariant.Dots}
          color="#354156"
          gap={24}
          size={1.4}
        />
        <Controls orientation="horizontal" showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === "worker" ? "#253047" : "#456ba4")}
          maskColor="rgba(13,16,23,.7)"
        />
        <div className="canvas-legend">
          <span>
            <i className="status-dot" />
            Running
          </span>
          <span>
            <i className="status-dot yellow" />
            Pending
          </span>
          <span>
            <i className="status-dot red" />
            Unhealthy
          </span>
          <span>
            <i className="status-dot gray" />
            Terminating
          </span>
        </div>
      </ReactFlow>
      <div className="canvas-hint">
        <Zap size={12} /> Click a resource to explore. Drag to move. Scroll to
        zoom.
      </div>
    </div>
  );
}
