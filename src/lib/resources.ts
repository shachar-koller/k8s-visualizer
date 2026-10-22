import { ClusterState, Selection } from "./simulation/types";
import { endpoints } from "./simulation/engine";
export function resourceObject(
  s: ClusterState,
  sel: Selection,
): Record<string, unknown> | null {
  const meta = (name: string, namespace?: string) => ({
    name,
    ...(namespace ? { namespace } : {}),
    labels: { app: name.split("-r")[0] },
  });
  if (sel.kind === "Deployment") {
    const d = s.deployments.find((d) => d.id === sel.id);
    if (!d) return null;
    return {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: meta(d.name, d.namespace),
      spec: {
        replicas: d.replicas,
        selector: { matchLabels: { app: d.name } },
        strategy: {
          type: "RollingUpdate",
          rollingUpdate: { maxSurge: 1, maxUnavailable: 0 },
        },
        template: {
          metadata: { labels: { app: d.name } },
          spec: {
            containers: [
              {
                name: d.name,
                image: d.image,
                resources: {
                  requests: { cpu: `${d.cpu}m`, memory: `${d.memory}Mi` },
                },
              },
            ],
            ...(d.nodeSelector
              ? {
                  nodeSelector: {
                    "topology.kubernetes.io/zone": d.nodeSelector,
                  },
                }
              : {}),
          },
        },
      },
      status: {
        readyReplicas: s.pods.filter(
          (p) => p.deploymentId === d.id && p.phase === "Running",
        ).length,
        observedGeneration: d.revision,
      },
    };
  }
  if (sel.kind === "Pod") {
    const p = s.pods.find((p) => p.id === sel.id);
    if (!p) return null;
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        ...meta(p.name, p.namespace),
        labels: {
          app:
            s.deployments.find((d) => d.id === p.deploymentId)?.name ?? p.name,
        },
        ownerReferences: p.replicaSet
          ? [{ apiVersion: "apps/v1", kind: "ReplicaSet", name: p.replicaSet }]
          : [],
      },
      spec: {
        nodeName: p.nodeId ?? null,
        containers: p.containers.map((name, i) => ({
          name,
          image: i === 0 ? p.image : "envoyproxy/envoy:v1.30",
          resources:
            i === 0
              ? { requests: { cpu: `${p.cpu}m`, memory: `${p.memory}Mi` } }
              : {},
        })),
      },
      status: {
        phase: ["CrashLoopBackOff", "ContainerCreating"].includes(p.phase)
          ? p.phase === "CrashLoopBackOff"
            ? "Running"
            : "Pending"
          : p.phase,
        containerState: p.phase,
        podIP: p.ip ?? null,
        ready: p.phase === "Running",
        restartCount: p.restarts,
      },
    };
  }
  if (sel.kind === "Node") {
    const n = s.nodes.find((n) => n.id === sel.id);
    if (!n) return null;
    return {
      apiVersion: "v1",
      kind: "Node",
      metadata: {
        ...meta(n.name),
        labels: { "topology.kubernetes.io/zone": n.zone },
      },
      spec: { unschedulable: n.cordoned },
      status: {
        allocatable: { cpu: `${n.cpu}m`, memory: `${n.memory}Mi` },
        addresses: [{ type: "InternalIP", address: n.ip }],
        conditions: [
          { type: "Ready", status: n.status === "Ready" ? "True" : "False" },
        ],
        nodeInfo: {
          kubeletVersion: "v1.30.2",
          containerRuntimeVersion: "containerd://1.7.18",
        },
      },
    };
  }
  if (sel.kind === "Service" || sel.kind === "Endpoints") {
    const v = s.services.find((v) => v.id === sel.id);
    if (!v) return null;
    return {
      apiVersion: "v1",
      kind: sel.kind,
      metadata: meta(v.name, v.namespace),
      ...(sel.kind === "Service"
        ? {
            spec: {
              type: v.type,
              clusterIP: v.ip,
              selector: {
                app: s.deployments.find((d) => d.id === v.deploymentId)?.name,
              },
              ports: [
                {
                  port: v.port,
                  targetPort: v.targetPort,
                  ...(v.type === "NodePort" ? { nodePort: 30080 } : {}),
                  protocol: "TCP",
                },
              ],
            },
          }
        : {
            subsets: [
              {
                addresses: endpoints(s, v.id).map((p) => ({
                  ip: p.ip,
                  targetRef: { kind: "Pod", name: p.name },
                })),
                ports: [{ port: v.targetPort }],
              },
            ],
          }),
    };
  }
  if (sel.kind === "ReplicaSet") {
    const pods = s.pods.filter((p) => p.replicaSet === sel.id);
    const d =
      s.deployments.find((d) => d.id === pods[0]?.deploymentId) ??
      s.deployments.find((d) => `${d.name}-r${d.revision}` === sel.id);
    return {
      apiVersion: "apps/v1",
      kind: "ReplicaSet",
      metadata: {
        ...meta(sel.id, d?.namespace),
        ownerReferences: [{ kind: "Deployment", name: d?.name }],
      },
      spec: { replicas: pods.filter((p) => p.phase !== "Terminating").length },
      status: {
        readyReplicas: pods.filter((p) => p.phase === "Running").length,
      },
    };
  }
  if (sel.kind === "Namespace")
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: sel.id },
      status: { phase: "Active" },
    };
  const a = s.auxiliary.find((a) => a.id === sel.id);
  if (a)
    return {
      apiVersion: a.kind === "Ingress" ? "networking.k8s.io/v1" : "v1",
      kind: a.kind,
      metadata: meta(a.name, a.namespace),
      [a.kind === "ConfigMap" || a.kind === "Secret" ? "data" : "spec"]: a.data,
    };
  return {
    kind: sel.kind,
    metadata: {
      name: sel.kind === "Cluster" ? "production-cluster" : "Control plane",
    },
    status: {
      nodes: s.nodes.length,
      kubernetesVersion: "v1.30.2",
      mode: "Simulated",
      components: ["API Server", "etcd", "Scheduler", "Controller Manager"],
    },
  };
}
export function yaml(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value))
    return value.length
      ? value
          .map((v) =>
            typeof v === "object" && v !== null
              ? `${pad}-\n${yaml(v, depth + 1)}`
              : `${pad}- ${String(v)}`,
          )
          .join("\n")
      : `${pad}[]`;
  if (typeof value === "object" && value !== null)
    return Object.entries(value)
      .map(
        ([key, v]) =>
          `${pad}${key}:${typeof v === "object" && v !== null ? `\n${yaml(v, depth + 1)}` : ` ${typeof v === "string" ? JSON.stringify(v) : (v ?? "null")}`}`,
      )
      .join("\n");
  return `${pad}${String(value)}`;
}
export function relationships(s: ClusterState, sel: Selection): Selection[] {
  if (sel.kind === "Deployment")
    return [
      ...new Set(
        s.pods
          .filter((p) => p.deploymentId === sel.id)
          .map((p) => p.replicaSet!),
      ),
    ].map((id) => ({ kind: "ReplicaSet", id }));
  if (sel.kind === "ReplicaSet")
    return s.pods
      .filter((p) => p.replicaSet === sel.id)
      .map((p) => ({ kind: "Pod", id: p.id }));
  if (sel.kind === "Pod") {
    const p = s.pods.find((p) => p.id === sel.id);
    if (!p) return [];
    return [
      ...(p.deploymentId
        ? [{ kind: "Deployment" as const, id: p.deploymentId }]
        : []),
      ...(p.replicaSet
        ? [{ kind: "ReplicaSet" as const, id: p.replicaSet }]
        : []),
      ...(p.nodeId ? [{ kind: "Node" as const, id: p.nodeId }] : []),
    ];
  }
  if (sel.kind === "Node")
    return s.pods
      .filter((p) => p.nodeId === sel.id)
      .map((p) => ({ kind: "Pod", id: p.id }));
  if (sel.kind === "Service" || sel.kind === "Endpoints")
    return endpoints(s, sel.id).map((p) => ({ kind: "Pod", id: p.id }));
  const a = s.auxiliary.find((a) => a.id === sel.id);
  return (a?.relatedIds ?? []).map((id) => ({
    kind:
      s.auxiliary.find((a) => a.id === id)?.kind ??
      (s.services.some((v) => v.id === id) ? "Service" : "Deployment"),
    id,
  }));
}
