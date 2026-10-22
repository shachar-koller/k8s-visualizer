"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Cpu,
  Ellipsis,
  ExternalLink,
  GitBranch,
  Globe,
  GraduationCap,
  HardDrive,
  Hexagon,
  Layers,
  LayoutDashboard,
  Maximize2,
  Menu,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useCluster, type Layout, type View } from "@/lib/store";
import { nodeUsage } from "@/lib/simulation/engine";
import { cn, time } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Topology } from "./topology";
import { Inspector } from "./inspector";
import {
  ControlPlane,
  NetworkingToolbar,
  Overview,
  Resources,
  ScenarioBanner,
  Scenarios,
  Settings as SettingsView,
  launchScenario,
} from "./views";
const nav: { name: View; icon: typeof Box }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Topology", icon: Workflow },
  { name: "Networking", icon: Network },
  { name: "Control plane", icon: Cpu },
  { name: "Resources", icon: Boxes },
  { name: "Scenarios", icon: GraduationCap },
];
const viewDescriptions: Record<View, string> = {
  Overview: "A clear view of your cluster’s health and capacity.",
  Topology: "See the connections. Understand the system.",
  Networking: "Trace a request from the outside world to a running pod.",
  "Control plane": "Make the invisible work of Kubernetes visible.",
  Resources: "Explore the objects that make up your cluster.",
  Scenarios: "Learn by doing, one experiment at a time.",
  Settings: "Make this workspace yours.",
};
function CreateDeployment({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { command, select, setView, notify } = useCluster();
  const [name, setName] = useState("nginx");
  const [image, setImage] = useState("nginx:1.25");
  const [replicas, setReplicas] = useState(3);
  const [cpu, setCpu] = useState(250);
  const [memory, setMemory] = useState(256);
  const [namespace, setNamespace] = useState("production");
  const [zone, setZone] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="dialog-heading-icon">
          <Boxes size={25} />
        </div>
        <DialogTitle className="dialog-title">Create a deployment</DialogTitle>
        <DialogDescription className="dialog-description">
          Describe your desired state. Watch Kubernetes bring it to life.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              command({
                type: "create-deployment",
                name,
                image,
                replicas,
                cpu,
                memory,
                namespace,
                nodeSelector: zone || undefined,
              });
              select({ kind: "Deployment", id: `${namespace}/${name}` });
              setView("Topology");
              onOpenChange(false);
              setError("");
              notify(`Deployment ${name} created. Reconciliation queued.`);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Deployment name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                maxLength={63}
                placeholder="nginx"
              />
            </label>
            <label>
              Namespace
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
              >
                <option>production</option>
                <option>default</option>
                <option>kube-system</option>
              </select>
            </label>
          </div>
          <label>
            Container image
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              required
              placeholder="nginx:1.25"
            />
          </label>
          <div className="form-grid three">
            <label>
              Replicas
              <input
                type="number"
                min={0}
                max={30}
                value={replicas}
                onChange={(e) => setReplicas(+e.target.value)}
                required
              />
            </label>
            <label>
              CPU request (m)
              <input
                type="number"
                min={1}
                value={cpu}
                onChange={(e) => setCpu(+e.target.value)}
                required
              />
            </label>
            <label>
              Memory (Mi)
              <input
                type="number"
                min={1}
                value={memory}
                onChange={(e) => setMemory(+e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Scheduling constraint
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Any available zone</option>
              {["us-east-1a", "us-east-1b", "us-east-1c"].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <div className="info-note">
            <ShieldCheck size={17} />
            <span>
              This creates simulated resources only. No real infrastructure or
              containers are provisioned.
            </span>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              <Plus size={15} />
              Create deployment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Timeline() {
  const {
    cluster,
    playing,
    setPlaying,
    speed,
    setSpeed,
    step,
    reset,
    rewind,
    history,
    select,
  } = useCluster();
  const [expanded, setExpanded] = useState(false);
  const [warnings, setWarnings] = useState(false);
  const rows = cluster.events
    .filter((e) => !warnings || e.type === "Warning")
    .slice(-35)
    .reverse();
  function inspect(id: string) {
    const kind = cluster.nodes.some((n) => n.id === id)
      ? "Node"
      : cluster.deployments.some((d) => d.id === id)
        ? "Deployment"
        : cluster.services.some((s) => s.id === id)
          ? "Service"
          : id === "cluster"
            ? "Cluster"
            : "Pod";
    select({ kind, id });
  }
  return (
    <section className={cn("event-timeline", expanded && "expanded")}>
      <div className="timeline-heading">
        <div>
          <Activity size={14} />
          <strong>Cluster events</strong>
          <span className="count-badge">{cluster.events.length}</span>
          <button
            className={cn("event-filter", warnings && "active")}
            onClick={() => setWarnings(!warnings)}
          >
            {warnings ? "Warnings only" : "All events"}
            <ChevronDown size={11} />
          </button>
        </div>
        <div className="playback-controls">
          <span className="simulation-clock">{time(cluster.clock)}</span>
          <button
            className="icon-btn"
            title="Rewind one recorded state"
            aria-label="Rewind simulation"
            onClick={rewind}
            disabled={!history.length}
          >
            <SkipBack size={13} />
          </button>
          <button
            className="play-toggle"
            aria-label={playing ? "Pause simulation" : "Resume simulation"}
            title={playing ? "Pause simulation" : "Resume simulation"}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            className="icon-btn"
            aria-label="Step simulation"
            title="Advance one simulation second"
            onClick={() => {
              setPlaying(false);
              step();
            }}
          >
            <SkipForward size={13} />
          </button>
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
          >
            {[0.5, 1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label="Reset simulation"
            title="Reset simulation"
            onClick={reset}
          >
            <RotateCcw size={13} />
          </button>
          <span className="control-divider" />
          <button
            className="icon-btn"
            aria-label={expanded ? "Collapse events" : "Expand events"}
            onClick={() => setExpanded(!expanded)}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
      <div className="event-rows">
        {rows.map((e) => (
          <button
            className="event-row"
            key={e.id}
            onClick={() => inspect(e.resourceId)}
          >
            <span className="event-time">{time(e.time)}</span>
            <span
              className={cn("event-type", e.type === "Warning" && "warning")}
            >
              <span
                className={cn("status-dot", e.type === "Warning" && "yellow")}
              />
              {e.type}
            </span>
            <strong>{e.reason}</strong>
            <span className="event-message" title={e.message}>
              {e.message}
            </span>
            <ArrowUpRight size={12} />
          </button>
        ))}
        {!rows.length && (
          <div className="timeline-empty">
            No warning events. Your cluster is healthy.
          </div>
        )}
      </div>
      <div className="timeline-footer">
        <span>
          <span className={cn("status-dot", !playing && "gray")} />
          {playing ? "Simulation running" : "Simulation paused"}
          <span className="footer-separator">·</span>Seed 42
        </span>
        <span>
          Local simulation<span className="footer-separator">·</span>Kubernetes
          v1.30.2
        </span>
      </div>
    </section>
  );
}
export function KubeScope() {
  const {
    cluster,
    view,
    setView,
    layout,
    setLayout,
    selected,
    select,
    playing,
    speed,
    step,
    namespace,
    setNamespace,
    search,
    setSearch,
    command,
    toast,
  } = useCluster();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.innerWidth < 950) select(null);
  }, [select]);
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(step, 1000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setActionsOpen(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const running = cluster.pods.filter((p) => p.phase === "Running").length;
  const pending = cluster.pods.filter((p) =>
    ["Pending", "ContainerCreating"].includes(p.phase),
  ).length;
  const readyNodes = cluster.nodes.filter(
    (n) => n.status === "Ready" && !n.offline,
  ).length;
  const usage = cluster.nodes.reduce(
    (a, n) => {
      const u = nodeUsage(cluster, n);
      return { cpu: a.cpu + u.cpu, memory: a.memory + u.memory };
    },
    { cpu: 0, memory: 0 },
  );
  const totalCpu = cluster.nodes.reduce((a, n) => a + n.cpu, 0);
  const totalMemory = cluster.nodes.reduce((a, n) => a + n.memory, 0);
  const topology = view === "Topology" || view === "Networking";
  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileNav && "mobile-open")}>
        <a className="brand" href="/" aria-label="KubeScope home">
          <span className="brand-mark">
            <Hexagon size={29} />
            <span>
              <Boxes size={14} />
            </span>
          </span>
          <span>
            Kube<span className="brand-light">Scope</span>
          </span>
          <span className="brand-beta">BETA</span>
        </a>
        <button
          className="cluster-switcher"
          onClick={() => {
            select({ kind: "Cluster", id: "cluster" });
            setMobileNav(false);
          }}
        >
          <span className="cluster-avatar">
            <Hexagon size={19} />
          </span>
          <span>
            <strong>production-cluster</strong>
            <small>
              <i className="status-dot" /> Simulation workspace
            </small>
          </span>
          <ChevronDown size={12} />
        </button>
        <div className="nav-label">Workspace</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.name}
              className={cn("nav-item", view === item.name && "active")}
              onClick={() => {
                setView(item.name);
                setMobileNav(false);
              }}
            >
              <item.icon size={17} />
              <span>
                {item.name === "Overview" ? "Cluster overview" : item.name}
              </span>
              {item.name === "Resources" && (
                <span className="nav-count">
                  {cluster.pods.length +
                    cluster.deployments.length +
                    cluster.services.length +
                    cluster.auxiliary.length +
                    cluster.nodes.length}
                </span>
              )}
              {item.name === "Scenarios" && <span className="new-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <button
          className={cn("nav-item", view === "Settings" && "active")}
          onClick={() => {
            setView("Settings");
            setMobileNav(false);
          }}
        >
          <Settings size={17} />
          Settings
        </button>
        <div className="sidebar-bottom">
          <div className="learn-card">
            <div>
              <span className="learn-icon">
                <Sparkles size={17} />
              </span>
              <span className="badge">Explore & learn</span>
            </div>
            <strong>Make Kubernetes click.</strong>
            <p>
              A safe space to break things
              <br />
              and see how they recover.
            </p>
            <button onClick={() => setView("Scenarios")}>
              Try a guided scenario
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => setView("Settings")}>
            <CircleHelp size={16} />
            Simulation guide
            <ArrowUpRight size={13} />
          </button>
          <div className="profile">
            <span className="profile-avatar">D</span>
            <div>
              <strong>Developer workspace</strong>
              <small>Local environment</small>
            </div>
            <ShieldCheck size={15} />
          </div>
        </div>
        <div className="sidebar-foot">
          <span
            className={cn(
              "status-dot",
              readyNodes !== cluster.nodes.length && "yellow",
            )}
          />{" "}
          {readyNodes === cluster.nodes.length
            ? "All nodes operational"
            : "Node disruption detected"}
          <span>v0.1.0</span>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="app-workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={19} />
            </button>
            <Hexagon size={15} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>{view === "Overview" ? "Cluster overview" : view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="simulation-badge">
              <span className="status-dot blue" />
              Simulation mode
            </span>
            <button
              className="icon-btn"
              aria-label="Open learning scenarios"
              title="Learning scenarios"
              onClick={() => setView("Scenarios")}
            >
              <BookOpen size={17} />
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar"
              aria-label="Workspace settings"
              onClick={() => setView("Settings")}
            >
              D
            </button>
          </div>
        </header>
        <div className="workspace-body">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="title-row">
                  <h1>
                    {view === "Topology"
                      ? "Cluster topology"
                      : view === "Overview"
                        ? "Cluster overview"
                        : view}
                  </h1>
                  {topology && (
                    <span
                      className={cn(
                        "badge",
                        readyNodes === cluster.nodes.length &&
                          running === cluster.pods.length &&
                          cluster.deployments.every(
                            (d) =>
                              cluster.pods.filter(
                                (p) =>
                                  p.deploymentId === d.id &&
                                  p.phase === "Running",
                              ).length >= d.replicas,
                          )
                          ? "badge-green"
                          : "badge-yellow",
                      )}
                    >
                      <span className="status-dot" />
                      {readyNodes === cluster.nodes.length &&
                      running === cluster.pods.length &&
                      cluster.deployments.every(
                        (d) =>
                          cluster.pods.filter(
                            (p) =>
                              p.deploymentId === d.id && p.phase === "Running",
                          ).length >= d.replicas,
                      )
                        ? "Healthy"
                        : "Reconciling"}
                    </span>
                  )}
                </div>
                <p>{viewDescriptions[view]}</p>
              </div>
              <div className="heading-actions">
                <div className="simulation-menu">
                  <Button
                    variant="secondary"
                    onClick={() => setActionsOpen(!actionsOpen)}
                    aria-expanded={actionsOpen}
                  >
                    <Zap size={14} />
                    Simulate
                    <ChevronDown size={12} />
                  </Button>
                  {actionsOpen && (
                    <>
                      <button
                        className="menu-dismiss"
                        aria-label="Close simulation actions"
                        onClick={() => setActionsOpen(false)}
                      />
                      <div className="action-dropdown">
                        {[
                          {
                            label: "Add a worker node",
                            icon: Server,
                            action: () => command({ type: "add-node" }),
                          },
                          {
                            label: "Delete a pod · self-healing",
                            icon: HeartIcon,
                            action: () => launchScenario("healing"),
                          },
                          {
                            label: "Simulate node failure",
                            icon: Zap,
                            action: () => launchScenario("failure"),
                          },
                          {
                            label: "Start a rolling update",
                            icon: RefreshIcon,
                            action: () => launchScenario("rolling"),
                          },
                          {
                            label: "Exhaust node resources",
                            icon: Cpu,
                            action: () => launchScenario("capacity"),
                          },
                          {
                            label: "Generate Service traffic",
                            icon: Network,
                            action: () => launchScenario("network"),
                          },
                        ].map((a) => (
                          <button
                            key={a.label}
                            onClick={() => {
                              a.action();
                              setActionsOpen(false);
                            }}
                          >
                            <a.icon size={15} />
                            {a.label}
                          </button>
                        ))}
                        <small>Guided experiments reset the cluster.</small>
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus size={15} />
                  <span>Create deployment</span>
                </Button>
              </div>
            </div>
            {["Topology", "Networking", "Overview"].includes(view) && (
              <div className="summary-strip">
                <button
                  onClick={() => {
                    setView("Resources");
                    setSearch("worker");
                  }}
                >
                  <div>
                    <Server size={15} />
                    <span>Worker nodes</span>
                  </div>
                  <strong>
                    {cluster.nodes.length}
                    <small>
                      <i
                        className={cn(
                          "status-dot",
                          readyNodes !== cluster.nodes.length && "yellow",
                        )}
                      />
                      {readyNodes} ready
                    </small>
                  </strong>
                  <span className="stat-mini">
                    {cluster.nodes.slice(0, 6).map((n) => (
                      <i
                        key={n.id}
                        style={
                          n.offline
                            ? { background: "#80505c", borderColor: "#a56d7b" }
                            : undefined
                        }
                      />
                    ))}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setView("Resources");
                    setSearch("");
                  }}
                >
                  <div>
                    <Box size={15} />
                    <span>Running pods</span>
                  </div>
                  <strong>
                    {running}
                    <small>/ {cluster.pods.length} total</small>
                  </strong>
                  <span className="stat-tag">
                    {pending ? `${pending} pending` : "All scheduled"}
                  </span>
                </button>
                <button onClick={() => setView("Overview")}>
                  <div>
                    <Cpu size={15} />
                    <span>CPU utilization</span>
                  </div>
                  <strong>
                    {Math.round((usage.cpu / totalCpu) * 100)}
                    <span className="stat-unit">%</span>
                    <small>
                      {(usage.cpu / 1000).toFixed(1)} / {totalCpu / 1000} cores
                    </small>
                  </strong>
                  <span className="stat-meter">
                    <i style={{ width: `${(usage.cpu / totalCpu) * 100}%` }} />
                  </span>
                </button>
                <button onClick={() => setView("Overview")}>
                  <div>
                    <HardDrive size={15} />
                    <span>Memory usage</span>
                  </div>
                  <strong>
                    {(usage.memory / 1024).toFixed(1)}
                    <span className="stat-unit">GiB</span>
                    <small>/ {totalMemory / 1024} GiB</small>
                  </strong>
                  <span className="stat-meter purple">
                    <i
                      style={{
                        width: `${(usage.memory / totalMemory) * 100}%`,
                      }}
                    />
                  </span>
                </button>
              </div>
            )}
            <ScenarioBanner />
            <div className="view-toolbar">
              {topology ? (
                <div className="layout-tabs">
                  {(view === "Networking"
                    ? ["Networking"]
                    : ["Physical", "Logical", "Networking", "Storage"]
                  ).map((l, i) => {
                    const Icon = [Server, GitBranch, Network, DatabaseIcon][i];
                    return (
                      <button
                        className={cn(
                          (view === "Networking" || layout === l) && "active",
                        )}
                        key={l}
                        onClick={() => setLayout(l as Layout)}
                      >
                        <Icon size={13} />
                        {l}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="toolbar-label">
                  <span className="status-dot blue" />
                  production-cluster
                </span>
              )}
              {(topology || view === "Resources") && (
                <div className="view-filters">
                  <select
                    aria-label="Namespace filter"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                  >
                    <option value="all">All namespaces</option>
                    {[
                      ...new Set([
                        "production",
                        "kube-system",
                        "default",
                        ...cluster.deployments.map((d) => d.namespace),
                      ]),
                    ].map((ns) => (
                      <option key={ns}>{ns}</option>
                    ))}
                  </select>
                  <div className="search-field">
                    <Search size={13} />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Find a resource…"
                      aria-label="Find a resource"
                    />
                    {search ? (
                      <button
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <kbd>⌘ K</kbd>
                    )}
                  </div>
                </div>
              )}
            </div>
            {view === "Networking" && <NetworkingToolbar />}
            <div className="view-content">
              {view === "Topology" ? (
                <Topology key={layout} mode={layout} />
              ) : view === "Networking" ? (
                <Topology key="network" mode="Networking" />
              ) : view === "Overview" ? (
                <Overview />
              ) : view === "Control plane" ? (
                <ControlPlane />
              ) : view === "Resources" ? (
                <Resources />
              ) : view === "Scenarios" ? (
                <Scenarios />
              ) : (
                <SettingsView />
              )}
            </div>
            <Timeline />
          </main>
          <AnimatePresence>
            {selected && <Inspector key={`${selected.kind}-${selected.id}`} />}
          </AnimatePresence>
        </div>
      </div>
      <CreateDeployment open={createOpen} onOpenChange={setCreateOpen} />
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
          >
            <Check size={16} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
const HeartIcon = Activity;
const RefreshIcon = RotateCcw;
const DatabaseIcon = HardDrive;
