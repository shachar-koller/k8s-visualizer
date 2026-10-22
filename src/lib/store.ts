import { create } from "zustand";
import { SimulatedClusterProvider } from "./simulation/provider";
import { ClusterState, Command, Selection } from "./simulation/types";
export type View =
  | "Overview"
  | "Topology"
  | "Networking"
  | "Control plane"
  | "Resources"
  | "Scenarios"
  | "Settings";
export type Layout = "Physical" | "Logical" | "Networking" | "Storage";
const provider = new SimulatedClusterProvider();
interface Store {
  cluster: ClusterState;
  history: ClusterState[];
  selected: Selection | null;
  view: View;
  layout: Layout;
  playing: boolean;
  speed: number;
  namespace: string;
  search: string;
  scenario: string | null;
  toast: string | null;
  select: (selected: Selection | null) => void;
  setView: (view: View) => void;
  setLayout: (layout: Layout) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setNamespace: (namespace: string) => void;
  setSearch: (search: string) => void;
  command: (c: Command) => void;
  step: () => void;
  reset: () => void;
  rewind: () => void;
  setScenario: (scenario: string | null) => void;
  notify: (message: string) => void;
}
export const useCluster = create<Store>((set, get) => ({
  cluster: provider.getSnapshot(),
  history: [],
  selected: { kind: "Deployment", id: "frontend" },
  view: "Topology",
  layout: "Physical",
  playing: true,
  speed: 1,
  namespace: "all",
  search: "",
  scenario: null,
  toast: null,
  select: (selected) => set({ selected }),
  setView: (view) => set({ view }),
  setLayout: (layout) => set({ layout }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setNamespace: (namespace) => set({ namespace }),
  setSearch: (search) => set({ search }),
  setScenario: (scenario) => set({ scenario }),
  command: (command) => {
    provider.dispatch(command);
  },
  step: () => provider.advance(),
  reset: () => {
    set({
      history: [],
      scenario: null,
      selected: { kind: "Deployment", id: "frontend" },
    });
    provider.reset();
    set({ history: [] });
  },
  rewind: () => {
    const h = get().history;
    if (!h.length) return;
    const previous = h[h.length - 1];
    provider.restore(previous);
    set({ history: h.slice(0, -1), playing: false });
  },
  notify: (toast) => {
    set({ toast });
    setTimeout(() => set({ toast: null }), 4000);
  },
}));
provider.subscribe((cluster) =>
  useCluster.setState((s) => ({
    cluster,
    history: [...s.history, s.cluster].slice(-180),
  })),
);
