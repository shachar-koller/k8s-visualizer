"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  FlaskConical,
  Menu,
  Search,
  X,
} from "lucide-react";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  chapters,
  glossary,
  PAPER_URL,
  type LabId,
} from "@/lib/dynamo/content";
import { Lab } from "./labs";

type View = "guide" | "labs" | "glossary";
const STORAGE_KEY = "dynamoscope-reading-v1";
const labOptions: { id: LabId; title: string; section: string }[] = [
  { id: "ring", title: "Hash ring & replicas", section: "§4.2–4.3" },
  { id: "quorum", title: "Read & write quorums", section: "§4.5" },
  { id: "versions", title: "Vector clocks", section: "§4.4" },
  { id: "handoff", title: "Hinted handoff", section: "§4.6" },
  { id: "merkle", title: "Merkle trees", section: "§4.7" },
  { id: "latency", title: "Tail latency", section: "§2.2" },
];
export function DynamoWorkspace() {
  const [chapterId, setChapterId] = useState("start");
  const [view, setView] = useState<View>("guide");
  const [labId, setLabId] = useState<LabId>("ring");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compactLabOpen, setCompactLabOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [savedLocally, setSavedLocally] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentIndex = chapters.findIndex(
    (chapter) => chapter.id === chapterId,
  );
  const chapter = chapters[currentIndex];
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "d-main") return;
      if (hash === "glossary") setView("glossary");
      else if (
        hash.startsWith("lab-") &&
        labOptions.some((lab) => lab.id === hash.slice(4))
      ) {
        setView("labs");
        setLabId(hash.slice(4) as LabId);
      } else {
        setView("guide");
        setChapterId(
          chapters.some((item) => item.id === hash) ? hash : "start",
        );
      }
    };
    readHash();
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]",
      );
      if (Array.isArray(saved))
        setCompleted([
          ...new Set(
            saved.filter(
              (id): id is string =>
                typeof id === "string" &&
                chapters.some((chapter) => chapter.id === id),
            ),
          ),
        ]);
    } catch {
      setSavedLocally(false);
    }
    setStorageReady(true);
    window.addEventListener("hashchange", readHash);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
      setSavedLocally(true);
    } catch {
      setSavedLocally(false);
    }
  }, [completed, storageReady]);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [chapterId, view, labId]);
  function navigate(hash: string) {
    window.location.hash = hash;
    setMobileOpen(false);
    setCompactLabOpen(false);
    setQuery("");
    // Heading remains mounted across navigation; focus it without changing scroll.
    requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true }),
    );
  }
  const needle = query.trim().toLowerCase();
  const filteredChapters = chapters.filter((item) =>
    `${item.title} ${item.subtitle} ${item.section} ${item.idea} ${item.terms.join(" ")} ${item.blocks.map((block) => `${block.title} ${block.text}`).join(" ")}`
      .toLowerCase()
      .includes(needle),
  );
  const filteredTerms = glossary.filter((item) =>
    `${item.term} ${item.definition}`.toLowerCase().includes(needle),
  );
  const isComplete = completed.includes(chapter.id);
  return (
    <div className="d-shell">
      <a className="d-skip" href="#d-main">
        Skip to content
      </a>
      <aside
        className={`d-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Dynamo navigation"
      >
        <Link href="/dynamo" className="d-brand">
          <Database size={25} />
          <span>
            Dynamo<span>Scope</span>
          </span>
        </Link>
        <WorkspaceSwitcher active="dynamo" />
        <div className="d-sidebar-intro">
          <BookOpen size={17} />
          <div>
            <strong>The Dynamo paper</strong>
            <span>Amazon · SOSP 2007</span>
          </div>
          <button
            className="d-close-menu"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="d-mode-nav" aria-label="Companion tools">
          <button
            aria-current={view === "guide" ? "page" : undefined}
            onClick={() => navigate(chapterId)}
          >
            <BookOpen size={15} /> Reading guide <span>{chapters.length}</span>
          </button>
          <button
            aria-current={view === "labs" ? "page" : undefined}
            onClick={() => navigate(`lab-${labId}`)}
          >
            <FlaskConical size={15} /> Interactive labs <span>6</span>
          </button>
          <button
            aria-current={view === "glossary" ? "page" : undefined}
            onClick={() => navigate("glossary")}
          >
            <Search size={15} /> Glossary <span>{glossary.length}</span>
          </button>
        </nav>
        <div className="d-nav-caption">Follow along with the paper</div>
        <nav className="d-chapter-nav" aria-label="Paper chapters">
          {chapters.map((item, index) => (
            <button
              key={item.id}
              aria-current={
                view === "guide" && chapterId === item.id ? "step" : undefined
              }
              onClick={() => navigate(item.id)}
            >
              <span className="d-chapter-index">
                {completed.includes(item.id) ? (
                  <Check size={12} aria-label="Read" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <small>{item.section}</small>
                {item.title}
              </span>
            </button>
          ))}
        </nav>
        <div className="d-progress">
          <div>
            <span>Your reading progress</span>
            <strong>
              {completed.length}/{chapters.length}
            </strong>
          </div>
          <progress
            value={completed.length}
            max={chapters.length}
            aria-label="Reading progress"
          />
          <small>
            {savedLocally
              ? "Saved in this browser"
              : "Progress available for this session only"}
          </small>
        </div>
        <a
          className="d-paper-link"
          href={PAPER_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open original paper <ExternalLink size={13} />
        </a>
      </aside>
      {mobileOpen && (
        <button
          className="d-nav-backdrop"
          aria-label="Close navigation backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="d-workspace">
        <header className="d-topbar">
          <div>
            <button
              className="d-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span>Distributed systems</span>
            <ChevronRight size={13} />
            <strong>
              {view === "guide"
                ? "Paper companion"
                : view === "labs"
                  ? "Interactive labs"
                  : "Glossary"}
            </strong>
          </div>
          <label className="d-search">
            <Search size={15} />
            <input
              ref={searchRef}
              aria-label="Search the companion"
              placeholder="Find a concept…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
            <kbd>⌘ K</kbd>
          </label>
        </header>
        <main className="d-main" id="d-main" ref={mainRef} tabIndex={-1}>
          {needle ? (
            <div className="d-search-results">
              <div className="d-page-title">
                <span>Search the companion</span>
                <h1 ref={headingRef} tabIndex={-1}>
                  Results for “{query}”
                </h1>
                <p>
                  {filteredChapters.length} chapters and {filteredTerms.length}{" "}
                  definitions
                </p>
              </div>
              {!filteredChapters.length && !filteredTerms.length && (
                <p className="d-empty">
                  No matching concepts. Try “quorum”, “clock”, “replica”, or a
                  paper section such as “4.6”.
                </p>
              )}
              {filteredChapters.map((item) => (
                <button
                  className="d-search-result"
                  key={item.id}
                  onClick={() => navigate(item.id)}
                >
                  <small>{item.section} · Reading guide</small>
                  <strong>
                    {item.title}
                    <ArrowRight size={16} />
                  </strong>
                  <p>{item.idea}</p>
                </button>
              ))}
              {filteredTerms.map((term) => (
                <button
                  className="d-search-result"
                  key={term.term}
                  onClick={() => navigate(term.chapter)}
                >
                  <small>Glossary · Open related chapter</small>
                  <strong>
                    {term.term}
                    <ArrowRight size={16} />
                  </strong>
                  <p>{term.definition}</p>
                </button>
              ))}
            </div>
          ) : view === "guide" ? (
            <>
              <div className="d-page-title">
                <div className="d-title-meta">
                  <span>{chapter.section}</span>
                  <a
                    href={`${PAPER_URL}#page=${chapter.page}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read this section in the paper <ExternalLink size={12} />
                  </a>
                </div>
                <h1 ref={headingRef} tabIndex={-1}>
                  {chapter.title}
                </h1>
                <p>{chapter.subtitle}</p>
              </div>
              <button
                className="d-compact-lab-toggle d-button"
                aria-expanded={compactLabOpen}
                aria-controls="chapter-lab"
                onClick={() => setCompactLabOpen(!compactLabOpen)}
              >
                <FlaskConical size={15} />
                {compactLabOpen
                  ? "Hide interactive lab"
                  : "Try the interactive lab"}
              </button>
              <div className="d-reading-layout">
                <article className="d-article" aria-label={chapter.title}>
                  <div className="d-big-idea">
                    <span>The central idea</span>
                    <p>{chapter.idea}</p>
                  </div>
                  {chapter.blocks.map((block) => (
                    <section className="d-prose" key={block.title}>
                      <h2>{block.title}</h2>
                      <p>{block.text}</p>
                    </section>
                  ))}
                  <section className="d-example">
                    <span>A concrete example</span>
                    <p>{chapter.example}</p>
                  </section>
                  <section className="d-pitfall">
                    <h2>Watch for this distinction</h2>
                    <p>{chapter.pitfall}</p>
                  </section>
                  <div className="d-terms">
                    <h2>Keep these terms handy</h2>
                    {chapter.terms.map((name) => {
                      const term = glossary.find((item) => item.term === name);
                      return (
                        term && (
                          <details key={name}>
                            <summary>
                              {name}
                              <ChevronRight size={13} />
                            </summary>
                            <p>{term.definition}</p>
                          </details>
                        )
                      );
                    })}
                  </div>
                  <section className="d-check">
                    <h2>Check your understanding</h2>
                    <p>{chapter.question}</p>
                    <details key={chapter.id}>
                      <summary>Reveal explanation</summary>
                      <p>{chapter.answer}</p>
                    </details>
                  </section>
                  <div className="d-reading-actions">
                    <button
                      className={`d-button ${isComplete ? "completed" : "primary"}`}
                      aria-pressed={isComplete}
                      onClick={() =>
                        setCompleted(
                          isComplete
                            ? completed.filter((id) => id !== chapter.id)
                            : [...completed, chapter.id],
                        )
                      }
                    >
                      <Check size={15} />
                      {isComplete ? "Marked as read" : "Mark as read"}
                    </button>
                    <span>
                      {currentIndex + 1} of {chapters.length} chapters
                    </span>
                  </div>
                  <nav className="d-pagination" aria-label="Chapter navigation">
                    <button
                      disabled={currentIndex === 0}
                      onClick={() => navigate(chapters[currentIndex - 1].id)}
                    >
                      <ArrowLeft size={15} />
                      <span>
                        <small>Previous</small>
                        {chapters[currentIndex - 1]?.title ??
                          "Beginning of guide"}
                      </span>
                    </button>
                    <button
                      disabled={currentIndex === chapters.length - 1}
                      onClick={() => navigate(chapters[currentIndex + 1].id)}
                    >
                      <span>
                        <small>Next chapter</small>
                        {chapters[currentIndex + 1]?.title ?? "Guide complete"}
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  </nav>
                </article>
                <aside
                  id="chapter-lab"
                  className={`d-lab-column ${compactLabOpen ? "is-expanded" : ""}`}
                >
                  <Lab key={chapter.lab} id={chapter.lab} />
                  <button
                    className="d-lab-expand"
                    onClick={() => navigate(`lab-${chapter.lab}`)}
                  >
                    Open in the lab workspace <ArrowRight size={13} />
                  </button>
                  <p className="d-source-note">
                    Companion to DeCandia et al.,{" "}
                    <cite>
                      Dynamo: Amazon’s Highly Available Key-value Store
                    </cite>
                    , SOSP ’07. Explanations are paraphrases; experiment
                    simplifications are labeled.
                  </p>
                </aside>
              </div>
            </>
          ) : view === "labs" ? (
            <>
              <div className="d-page-title">
                <span>Learn by changing the system</span>
                <h1 ref={headingRef} tabIndex={-1}>
                  Dynamo, in motion.
                </h1>
                <p>Six small experiments. One connected set of ideas.</p>
              </div>
              <div className="d-labs-layout">
                <nav className="d-lab-picker" aria-label="Choose an experiment">
                  {labOptions.map((lab) => (
                    <button
                      key={lab.id}
                      aria-current={lab.id === labId ? "page" : undefined}
                      onClick={() => navigate(`lab-${lab.id}`)}
                    >
                      <span>{lab.section}</span>
                      <strong>{lab.title}</strong>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  <div className="d-lab-reading">
                    <BookOpen size={19} />
                    <p>Want the reasoning behind the experiment?</p>
                    <button
                      className="d-button"
                      onClick={() =>
                        navigate(
                          {
                            ring: "partitioning",
                            quorum: "quorums",
                            versions: "versioning",
                            handoff: "handoff",
                            merkle: "anti-entropy",
                            latency: "latency",
                          }[labId],
                        )
                      }
                    >
                      Read the related chapter
                    </button>
                  </div>
                </nav>
                <Lab key={labId} id={labId} />
              </div>
            </>
          ) : (
            <>
              <div className="d-page-title">
                <span>A reference while you read</span>
                <h1 ref={headingRef} tabIndex={-1}>
                  The vocabulary of Dynamo.
                </h1>
                <p>
                  {glossary.length} definitions, with a route back to the
                  explanation. Use the search above to find a term.
                </p>
              </div>
              <div className="d-glossary">
                {[...glossary]
                  .sort((a, b) => a.term.localeCompare(b.term))
                  .map((term) => (
                    <section key={term.term}>
                      <h2>{term.term}</h2>
                      <p>{term.definition}</p>
                      <button onClick={() => navigate(term.chapter)}>
                        Explore in the guide <ArrowRight size={13} />
                      </button>
                    </section>
                  ))}
              </div>
            </>
          )}
          <footer className="d-footer">
            <span>Dynamo (2007), not the DynamoDB service.</span>
            <a href={PAPER_URL} target="_blank" rel="noreferrer">
              Source paper <ExternalLink size={11} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
