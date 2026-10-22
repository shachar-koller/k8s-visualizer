# KubeScope

An interactive Kubernetes learning environment built with Next.js 16, TypeScript, Tailwind CSS 4, shadcn-style Radix components, React Flow, Zustand, Motion, and Lucide.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. No API keys or Kubernetes credentials are needed.

```sh
npm test          # Simulation invariant tests
npm run typecheck # Strict TypeScript validation
npm run build     # Production static export in out/
```

The production output is fully static. After building, `npm start` serves `out/` on port 3000; the output also works on any static host.

## Start exploring

The initial cluster has three workers, four Deployments, nine Pods, and three Services across `production` and `kube-system`. The frontend Deployment is selected by default on desktop.

- **Scale:** use the inspector’s replica controls. The next controller tick creates Pending pods, the scheduler assigns eligible nodes, and the kubelet starts containers.
- **Delete a Pod:** click its card, then **Delete pod**. Its ReplicaSet creates a replacement with a new identity. Unmanaged pods are never automatically recreated.
- **Pause and step:** use the event timeline. Each step advances one simulation second. Rewind restores the previous recorded state (including queue, RNG seed, and clock), with 180 states retained.
- **Create:** configure replicas, image, CPU, memory, namespace, and an optional zone constraint.
- **Experiment:** select a Node to drain or fail it; select a Pod to trigger or resolve a CrashLoopBackOff; select a Deployment to update its image and resource requests.
- **Network:** send one or more HTTP requests, inspect DNS and endpoint selection, and watch ready destination pods highlight.
- **Learn:** six scenarios reset the cluster to a known initial state. The seven-stage control-plane walkthrough creates an actual simulated Deployment and pauses the shared clock while you step through it.
- **Inspect:** Overview, YAML, Events, Logs, and Relations all derive from the same cluster state. YAML can be copied. Logs are explicitly simulated lifecycle events.

Keyboard: Ctrl/Cmd+K focuses resource search. Escape dismisses the action menu and mobile navigation. Resource table rows and graph objects support keyboard selection.

## Architecture

```
src/lib/simulation/types.ts     Kubernetes resource and command models
src/lib/simulation/engine.ts    Pure deterministic transition functions
src/lib/simulation/provider.ts Snapshot/subscription provider boundary
src/lib/store.ts               Zustand UI state and snapshot replay history
src/lib/resources.ts           Inspector projections, relationships, and YAML
src/components/topology.tsx    React Flow projections for four layout modes
src/components/inspector.tsx   Resource details and mutation controls
src/components/views.tsx       Scenarios, metrics, networking, control plane
src/components/kubescope.tsx   Application shell, timeline, creation dialog
```

The simulation separates desired Deployment state from observed Pod state. Every tick processes due events in stable `(time, sequence)` order and then reconciles controllers. A seeded LCG produces reproducible Pod identities. All commands and transitions clone input state; React is not imported by the simulation.

The scheduler checks node readiness, cordons, zone constraints, aggregate requested CPU, and requested memory. It selects the least allocated CPU fraction among eligible nodes, breaking ties by node ID. Resource requests are reserved at assignment and released only when termination completes. A service selects only Running pods on ready, reachable nodes. Traffic affects simulated CPU usage for ten ticks.

Rolling updates use `maxSurge: 1` and `maxUnavailable: 0`, retaining healthy old replicas until replacement replicas are ready. Terminating pods can temporarily take the total object count above the surge budget, as in Kubernetes; they retain their allocations until deletion.

The provider contract intentionally separates read-only snapshots/subscriptions from simulation mutation and clock controls. `SimulatedClusterProvider` implements the current application. `LiveClusterProvider` is a non-operational future adapter. Implement Kubernetes access on a trusted server, using server-held credentials and read-only watches; do not expose kubeconfig or API tokens to browsers.

## Simulation boundaries

This is a teaching model, not a Kubernetes emulator:

- Failure detection is compressed to 5 ticks; eviction follows after a further 12 ticks. Existing Pods do not instantly relocate.
- Scheduling takes one tick; container startup takes two more. Admission, image pulling, and runtime behavior are simplified.
- Pod phase display includes container waiting reasons (ContainerCreating and CrashLoopBackOff). YAML distinguishes Kubernetes phase from the container state.
- Service routing is deterministic round-robin. Real dataplanes vary by kube-proxy/eBPF mode and connection behavior. DNS is illustrated rather than implemented.
- Requests are an aggregate Pod budget. Real per-container limits, probes, QoS, and OOM behavior are not modeled.
- Persistent storage objects illustrate PVC/PV/workload relationships; attachment, access-mode scheduling, and persistence are not enforced. Redis is deliberately a Deployment in this teaching sample.
- ConfigMaps and Secrets are illustrative; no real secrets are stored.
- Logs are lifecycle event projections, not container stdout. Metrics are deterministic synthetic measurements derived from running workloads, requests, and the clock.
- History and workspace state are browser-memory only; reload resets the simulation.

## Verification

Engine tests cover deterministic initialization/replay, scaling, managed and unmanaged deletion, capacity and zone constraints, delayed node failure/eviction, recovery, draining, rollout availability, resource update scheduling, CrashLoop backoff/recovery, endpoint selection, and HTTP 503 when no endpoints are ready. Browser checks cover the complete scale/delete/replace flow, walkthrough execution, constraints scenario, YAML inspection, and HTTP routing.
