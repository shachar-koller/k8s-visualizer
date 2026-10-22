"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  GitBranch,
  HardDrive,
  Info,
  Layers,
  Minus,
  MoreHorizontal,
  Network,
  Plus,
  RefreshCw,
  RotateCw,
  Server,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCluster } from "@/lib/store";
import {
  allocation,
  endpoints,
  nodeUsage,
  podUsage,
} from "@/lib/simulation/engine";
import { relationships, resourceObject, yaml } from "@/lib/resources";
import { cn, time } from "@/lib/utils";
import { Button } from "./ui/button";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="inspector-field">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
export function Inspector() {
  const { selected, select, cluster, history, command, notify } = useCluster();
  const [tab, setTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [image, setImage] = useState("");
  const [cpu, setCpu] = useState(250);
  const [memory, setMemory] = useState(256);
  const [copied, setCopied] = useState(false);
  if (!selected) return null;
  const obj = resourceObject(cluster, selected);
  const d = cluster.deployments.find(
    (d) => selected.kind === "Deployment" && d.id === selected.id,
  );
  const p = cluster.pods.find(
    (p) => selected.kind === "Pod" && p.id === selected.id,
  );
  const n = cluster.nodes.find(
    (n) => selected.kind === "Node" && n.id === selected.id,
  );
  const svc = cluster.services.find(
    (v) =>
      (selected.kind === "Service" || selected.kind === "Endpoints") &&
      v.id === selected.id,
  );
  const name = (obj?.metadata as { name?: string })?.name ?? selected.id;
  const ns = (obj?.metadata as { namespace?: string })?.namespace;
  const related = relationships(cluster, selected);
  const events = cluster.events.filter(
    (e) =>
      e.resourceId === selected.id ||
      (d &&
        cluster.pods.some(
          (p) => p.deploymentId === d.id && p.id === e.resourceId,
        )),
  );
  const ready = d
    ? cluster.pods.filter(
        (p) => p.deploymentId === d.id && p.phase === "Running",
      ).length
    : 0;
  const status = !obj
    ? "Deleted"
    : d
      ? ready >= d.replicas
        ? "Available"
        : "Progressing"
      : (p?.phase ?? n?.status ?? "Active");
  const usage = p
    ? podUsage(cluster, p)
    : n
      ? nodeUsage(cluster, n)
      : d
        ? cluster.pods
            .filter((p) => p.deploymentId === d.id)
            .reduce(
              (a, p) => {
                const u = podUsage(cluster, p);
                return { cpu: a.cpu + u.cpu, memory: a.memory + u.memory };
              },
              { cpu: 0, memory: 0 },
            )
        : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml(obj));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Clipboard unavailable. Select and copy the YAML text.");
    }
  };
  return (
    <motion.aside
      className="inspector"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="inspector-topline">
        <span>Resource inspector</span>
        <button
          className="icon-btn"
          onClick={() => select(null)}
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>
      <div className="inspector-title">
        <div
          className={cn(
            "big-resource-icon",
            `tone-${d?.color ?? p?.color ?? "blue"}`,
          )}
        >
          {n ? (
            <Server size={23} />
          ) : p ? (
            <Box size={23} />
          ) : svc ? (
            <Network size={23} />
          ) : (
            <Boxes size={23} />
          )}
        </div>
        <div>
          <small>{selected.kind}</small>
          <h2 title={name}>{name}</h2>
        </div>
      </div>
      <div className="inspector-meta">
        <span className="badge badge-green">
          <i
            className={cn(
              "status-dot",
              !["Available", "Running", "Ready", "Active"].includes(status) &&
                "yellow",
            )}
          />
          {status}
        </span>
        {ns && (
          <span>
            <Layers size={11} />
            {ns}
          </span>
        )}
      </div>
      <div className="inspector-tabs">
        {["Overview", "YAML", "Events", "Logs", "Relations"].map((t) => (
          <button
            key={t}
            className={cn(tab === t && "active")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="inspector-body">
        {!obj && !["Events", "Logs"].includes(tab) ? (
          <div className="empty-state">
            <Trash2 size={28} />
            <h3>Resource deleted</h3>
            <p>
              Its lifecycle is preserved in Events. Select a replacement pod on
              the canvas.
            </p>
          </div>
        ) : tab === "Overview" ? (
          <>
            <section className="inspector-section">
              <h3>Details</h3>
              <Field label="Name">
                <span className="mono truncate" title={name}>
                  {name}
                </span>
              </Field>
              {ns && (
                <Field label="Namespace">
                  <button
                    className="link"
                    onClick={() => select({ kind: "Namespace", id: ns })}
                  >
                    {ns}
                    <ArrowUpRight size={11} />
                  </button>
                </Field>
              )}
              <Field label="Status">
                <span
                  className={
                    ["Available", "Running", "Ready", "Active"].includes(status)
                      ? "text-green"
                      : "text-yellow"
                  }
                >
                  {status}
                </span>
              </Field>
              {d && (
                <>
                  <Field label="Replicas">
                    <span>
                      {ready} ready{" "}
                      <span className="muted">/ {d.replicas} desired</span>
                    </span>
                  </Field>
                  <Field label="Strategy">
                    <span className="mono">RollingUpdate</span>
                  </Field>
                </>
              )}
              {(d || p) && (
                <Field label="Image">
                  <span className="mono truncate" title={d?.image ?? p?.image}>
                    {d?.image ?? p?.image}
                  </span>
                </Field>
              )}
              {p && (
                <>
                  <Field label="Node">
                    <button
                      className="link"
                      onClick={() =>
                        p.nodeId && select({ kind: "Node", id: p.nodeId })
                      }
                    >
                      {p.nodeId ?? "Unscheduled"}
                    </button>
                  </Field>
                  <Field label="Pod IP">
                    <span className="mono">{p.ip ?? "Not assigned"}</span>
                  </Field>
                  <Field label="Restarts">{p.restarts}</Field>
                  <Field label="Age">{cluster.clock - p.createdAt}s</Field>
                </>
              )}
              {n && (
                <>
                  <Field label="Internal IP">
                    <span className="mono">{n.ip}</span>
                  </Field>
                  <Field label="Zone">{n.zone}</Field>
                  <Field label="Allocated CPU">
                    {allocation(cluster, n.id).cpu} / {n.cpu}m
                  </Field>
                  <Field label="Allocated memory">
                    {allocation(cluster, n.id).memory} / {n.memory}Mi
                  </Field>
                </>
              )}
              {svc && (
                <>
                  <Field label="Type">{svc.type}</Field>
                  <Field label="Cluster IP">
                    <span className="mono">{svc.ip}</span>
                  </Field>
                  <Field label="Port">
                    {svc.port} → {svc.targetPort}
                  </Field>
                  <Field label="Ready endpoints">
                    {endpoints(cluster, svc.id).length}
                  </Field>
                  <Field label="Requests">{svc.requests}</Field>
                </>
              )}
            </section>
            {d && (
              <section className="inspector-section">
                <h3>
                  Scale deployment<span>Desired state</span>
                </h3>
                <div className="scale-control">
                  <button
                    onClick={() =>
                      command({
                        type: "scale",
                        id: d.id,
                        replicas: d.replicas - 1,
                      })
                    }
                    disabled={!d.replicas}
                    aria-label="Decrease replicas"
                  >
                    <Minus size={15} />
                  </button>
                  <span>
                    <strong>{d.replicas}</strong> replicas
                  </span>
                  <button
                    onClick={() =>
                      command({
                        type: "scale",
                        id: d.id,
                        replicas: d.replicas + 1,
                      })
                    }
                    disabled={d.replicas >= 30}
                    aria-label="Increase replicas"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <p className="field-help">
                  The controller will reconcile your desired replica count.
                </p>
                <div className="replica-dots">
                  {Array.from(
                    { length: Math.max(d.replicas, ready) },
                    (_, i) => (
                      <span className={i < ready ? "ready" : ""} key={i}>
                        <Box size={15} />
                      </span>
                    ),
                  )}
                </div>
              </section>
            )}
            {(d || p) && (
              <section className="inspector-section">
                <h3>Labels</h3>
                <div className="label-chips">
                  <span>
                    app{" "}
                    <b>
                      {d?.name ??
                        cluster.deployments.find(
                          (d) => d.id === p?.deploymentId,
                        )?.name ??
                        "unmanaged"}
                    </b>
                  </span>
                  <span>
                    revision <b>{d?.revision ?? p?.revision}</b>
                  </span>
                </div>
              </section>
            )}
            {usage && (
              <section className="inspector-section">
                <h3>
                  Resource usage<span>Simulated</span>
                </h3>
                <div className="inspector-metrics">
                  <div>
                    <small>
                      <Cpu size={12} /> CPU
                    </small>
                    <strong>
                      {usage.cpu}
                      <span> m</span>
                    </strong>
                    <div className="mini-bars">
                      {[...history.slice(-15), cluster].map((snapshot, i) => {
                        const pods = snapshot.pods.filter((pod) =>
                          p
                            ? pod.id === p.id
                            : n
                              ? pod.nodeId === n.id
                              : pod.deploymentId === d?.id,
                        );
                        const value = pods.reduce(
                          (sum, pod) => sum + podUsage(snapshot, pod).cpu,
                          0,
                        );
                        const budget =
                          n?.cpu ??
                          (d ? d.cpu * Math.max(1, d.replicas) : (p?.cpu ?? 1));
                        return (
                          <i
                            key={i}
                            style={{
                              height: `${Math.max(1, Math.min(32, (value / budget) * 32))}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <small>
                      <HardDrive size={12} /> Memory
                    </small>
                    <strong>
                      {usage.memory}
                      <span> Mi</span>
                    </strong>
                    <div className="metric-track">
                      <i
                        style={{
                          width: `${Math.min(100, (usage.memory / (n?.memory ?? (d?.memory ?? p?.memory ?? 512) * (d?.replicas ?? 1))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {(d || p) && (
                  <p className="field-help">
                    Requests per pod: {d?.cpu ?? p?.cpu}m CPU ·{" "}
                    {d?.memory ?? p?.memory}Mi memory
                  </p>
                )}
              </section>
            )}
            {p && (
              <section className="inspector-section">
                <h3>
                  Containers<span>{p.containers.length}</span>
                </h3>
                {p.containers.map((c) => (
                  <div className="container-row" key={c}>
                    <Box size={14} />
                    <span>{c}</span>
                    <span
                      className={
                        p.phase === "Running" ? "text-green" : "text-yellow"
                      }
                    >
                      {p.phase === "Running" ? "Running" : "Waiting"}
                    </span>
                  </div>
                ))}
                <p className="field-help">
                  Resource requests represent the aggregate pod budget.
                </p>
              </section>
            )}
            <section className="inspector-section">
              <h3>
                Relationships<span>{related.length}</span>
              </h3>
              {related.slice(0, 5).map((r) => (
                <button
                  className="relationship"
                  key={r.id}
                  onClick={() => select(r)}
                >
                  <GitBranch size={14} />
                  <span>
                    <small>{r.kind}</small>
                    {r.id}
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!related.length && <p className="muted">No owner references.</p>}
            </section>
            <section className="inspector-section actions">
              <h3>Simulation actions</h3>
              {d && (
                <>
                  <Button
                    variant="secondary"
                    className="full-width"
                    onClick={() => {
                      setEditing(!editing);
                      setImage(d.image);
                      setCpu(d.cpu);
                      setMemory(d.memory);
                    }}
                  >
                    <RefreshCw size={14} /> Update image & resources
                  </Button>
                  {editing && (
                    <form
                      className="update-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        try {
                          command({
                            type: "update-deployment",
                            id: d.id,
                            image,
                            cpu,
                            memory,
                          });
                          setEditing(false);
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <label>
                        Container image
                        <input
                          required
                          value={image}
                          onChange={(e) => setImage(e.target.value)}
                        />
                      </label>
                      <div className="form-grid">
                        <label>
                          CPU (m)
                          <input
                            required
                            type="number"
                            min={1}
                            value={cpu}
                            onChange={(e) => setCpu(+e.target.value)}
                          />
                        </label>
                        <label>
                          Memory (Mi)
                          <input
                            required
                            type="number"
                            min={1}
                            value={memory}
                            onChange={(e) => setMemory(+e.target.value)}
                          />
                        </label>
                      </div>
                      <Button type="submit" size="sm">
                        Start rolling update
                      </Button>
                    </form>
                  )}
                </>
              )}
              {p && (
                <>
                  <Button
                    variant="danger"
                    className="full-width"
                    onClick={() => command({ type: "delete-pod", id: p.id })}
                    disabled={p.phase === "Terminating"}
                  >
                    <Trash2 size={14} /> Delete pod
                  </Button>
                  <Button
                    variant="secondary"
                    className="full-width"
                    disabled={
                      !["Running", "CrashLoopBackOff"].includes(p.phase)
                    }
                    onClick={() =>
                      command({
                        type:
                          p.phase === "CrashLoopBackOff"
                            ? "recover-pod"
                            : "crash-pod",
                        id: p.id,
                      })
                    }
                  >
                    <Zap size={14} />
                    {p.phase === "CrashLoopBackOff"
                      ? "Resolve container fault"
                      : "Trigger CrashLoopBackOff"}
                  </Button>
                  <p className="field-help">
                    {p.deploymentId
                      ? "Its ReplicaSet will create a replacement after deletion."
                      : "Unmanaged pods are not recreated."}
                  </p>
                </>
              )}
              {n && (
                <>
                  <Button
                    variant="secondary"
                    className="full-width"
                    onClick={() =>
                      command({
                        type:
                          n.cordoned || n.offline
                            ? "recover-node"
                            : "drain-node",
                        id: n.id,
                      })
                    }
                  >
                    {n.cordoned || n.offline
                      ? "Recover & uncordon node"
                      : "Drain node"}
                  </Button>
                  <Button
                    variant="danger"
                    className="full-width"
                    onClick={() => command({ type: "fail-node", id: n.id })}
                    disabled={n.offline}
                  >
                    <Zap size={14} /> Simulate node failure
                  </Button>
                </>
              )}
              {svc && (
                <Button
                  className="full-width"
                  onClick={() =>
                    command({ type: "traffic", id: svc.id, count: 10 })
                  }
                >
                  <Zap size={14} /> Send 10 HTTP requests
                </Button>
              )}
              {!d && !p && !n && !svc && (
                <p className="muted">
                  Inspect configuration in YAML, or explore related resources.
                </p>
              )}
            </section>
          </>
        ) : tab === "YAML" ? (
          <div className="yaml-view">
            <div className="yaml-header">
              <span>{name}.yaml</span>
              <button
                className="icon-btn"
                aria-label="Copy YAML"
                onClick={copy}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <pre>
              {yaml(obj)
                .split("\n")
                .map((line, i) => (
                  <div key={i}>
                    <span className="line-number">{i + 1}</span>
                    <code>
                      <span className="yaml-key">
                        {line.includes(":")
                          ? line.slice(0, line.indexOf(":") + 1)
                          : line}
                      </span>
                      <span>
                        {line.includes(":")
                          ? line.slice(line.indexOf(":") + 1)
                          : ""}
                      </span>
                    </code>
                  </div>
                ))}
            </pre>
          </div>
        ) : tab === "Events" ? (
          <div className="resource-events">
            {events
              .slice()
              .reverse()
              .map((e) => (
                <div key={e.id}>
                  <span
                    className={cn(
                      "status-dot",
                      e.type === "Warning" && "yellow",
                    )}
                  />
                  <div>
                    <strong>{e.reason}</strong>
                    <small>
                      {time(e.time)} · {e.component}
                    </small>
                    <p>{e.message}</p>
                  </div>
                </div>
              ))}
            {!events.length && (
              <p className="muted">No events for this resource yet.</p>
            )}
          </div>
        ) : tab === "Logs" ? (
          <div className="logs-view">
            <div className="info-note">
              <Terminal size={16} />
              <span>
                Simulated lifecycle logs. No real container output is collected.
              </span>
            </div>
            {events
              .filter((e) =>
                [
                  "Started",
                  "BackOff",
                  "Killing",
                  "Scheduled",
                  "TrafficRouted",
                ].includes(e.reason),
              )
              .map((e) => (
                <p key={e.id}>
                  <span>{time(e.time)}</span> [{e.component}] {e.message}
                </p>
              ))}
            {!events.length && <p>No lifecycle logs available.</p>}
          </div>
        ) : (
          <section className="inspector-section">
            {related.map((r) => (
              <button
                className="relationship"
                key={r.id}
                onClick={() => select(r)}
              >
                <GitBranch size={15} />
                <span>
                  <small>{r.kind}</small>
                  {r.id}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!related.length && <p className="muted">No related resources.</p>}
          </section>
        )}
      </div>
      <div className="inspector-footer">
        <Info size={12} /> Changes only affect this simulation
      </div>
    </motion.aside>
  );
}
