import Link from "next/link";
import { Database, Hexagon } from "lucide-react";

export function WorkspaceSwitcher({ active }: { active: "kubernetes" | "dynamo" }) {
  return (
    <nav className="workspace-switcher" aria-label="Learning workspace">
      <Link href="/" aria-current={active === "kubernetes" ? "page" : undefined}>
        <Hexagon size={14} /> Kubernetes
      </Link>
      <Link href="/dynamo" aria-current={active === "dynamo" ? "page" : undefined}>
        <Database size={14} /> Dynamo
      </Link>
    </nav>
  );
}
