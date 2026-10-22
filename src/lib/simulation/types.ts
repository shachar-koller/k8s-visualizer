export type Phase =
  | "Pending"
  | "ContainerCreating"
  | "Running"
  | "Terminating"
  | "CrashLoopBackOff"
  | "Unknown";
export type ResourceKind =
  | "Cluster"
  | "Node"
  | "Namespace"
  | "Deployment"
  | "ReplicaSet"
  | "Pod"
  | "Service"
  | "Ingress"
  | "ConfigMap"
  | "Secret"
  | "PersistentVolume"
  | "PersistentVolumeClaim"
  | "ControlPlane"
  | "Endpoints";
export interface Selection {
  kind: ResourceKind;
  id: string;
}
export interface Worker {
  id: string;
  name: string;
  ip: string;
  cpu: number;
  memory: number;
  status: "Ready" | "NotReady";
  cordoned: boolean;
  offline: boolean;
  zone: string;
}
export interface Deployment {
  id: string;
  name: string;
  namespace: string;
  replicas: number;
  image: string;
  cpu: number;
  memory: number;
  revision: number;
  color: string;
  updating: boolean;
  nodeSelector?: string;
}
export interface Pod {
  id: string;
  name: string;
  namespace: string;
  deploymentId?: string;
  replicaSet?: string;
  revision: number;
  image: string;
  nodeId?: string;
  ip?: string;
  phase: Phase;
  cpu: number;
  memory: number;
  createdAt: number;
  restarts: number;
  fault: boolean;
  containers: string[];
  color: string;
}
export interface Service {
  id: string;
  name: string;
  namespace: string;
  deploymentId: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer";
  ip: string;
  port: number;
  targetPort: number;
  requests: number;
  cursor: number;
}
export interface Auxiliary {
  id: string;
  kind: ResourceKind;
  name: string;
  namespace?: string;
  data: Record<string, string>;
  relatedIds: string[];
}
export interface ClusterEvent {
  id: number;
  time: number;
  type: "Normal" | "Warning";
  reason: string;
  message: string;
  resourceId: string;
  component: string;
}
export interface ScheduledEvent {
  id: number;
  at: number;
  type:
    "schedule" | "start" | "remove" | "detect-failure" | "evict" | "restart";
  target: string;
}
export interface RequestTrace {
  id: number;
  time: number;
  serviceId: string;
  podId?: string;
  status: number;
  path: string;
}
export interface ClusterState {
  clock: number;
  seed: number;
  sequence: number;
  nodes: Worker[];
  deployments: Deployment[];
  pods: Pod[];
  services: Service[];
  auxiliary: Auxiliary[];
  queue: ScheduledEvent[];
  events: ClusterEvent[];
  requests: RequestTrace[];
}
export type Command =
  | { type: "scale"; id: string; replicas: number }
  | {
      type:
        | "delete-pod"
        | "fail-node"
        | "drain-node"
        | "recover-node"
        | "crash-pod"
        | "recover-pod";
      id: string;
    }
  | { type: "add-node" }
  | {
      type: "create-deployment";
      name: string;
      namespace: string;
      replicas: number;
      image: string;
      cpu: number;
      memory: number;
      nodeSelector?: string;
    }
  | {
      type: "update-deployment";
      id: string;
      image?: string;
      cpu?: number;
      memory?: number;
    }
  | { type: "traffic"; id: string; count: number };
