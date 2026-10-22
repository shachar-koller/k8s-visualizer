import { advance, createInitialState, dispatch } from "./engine";
import { ClusterState, Command } from "./types";
export interface ClusterProvider {
  readonly mode: "simulation" | "live";
  getSnapshot(): ClusterState;
  subscribe(listener: (state: ClusterState) => void): () => void;
}
export interface MutableClusterProvider extends ClusterProvider {
  dispatch(command: Command): void;
  advance(ticks?: number): void;
  reset(seed?: number): void;
}
export class SimulatedClusterProvider implements MutableClusterProvider {
  readonly mode = "simulation" as const;
  private state = createInitialState();
  private listeners = new Set<(state: ClusterState) => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: (state: ClusterState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: ClusterState) {
    this.state = state;
    this.listeners.forEach((l) => l(state));
  }
  dispatch(command: Command) {
    this.publish(dispatch(this.state, command));
  }
  advance(ticks = 1) {
    this.publish(advance(this.state, ticks));
  }
  reset(seed = 42) {
    this.publish(createInitialState(seed));
  }
  restore(snapshot: ClusterState) {
    this.publish(structuredClone(snapshot));
  }
}
/** Future server-side adapter. Browser credentials and mutation methods are deliberately absent. */
export class LiveClusterProvider implements ClusterProvider {
  readonly mode = "live" as const;
  getSnapshot(): ClusterState {
    throw new Error(
      "Live clusters are not connected. Implement a server-side, read-only watch adapter.",
    );
  }
  subscribe(): () => void {
    throw new Error("Live watches are not implemented.");
  }
}
