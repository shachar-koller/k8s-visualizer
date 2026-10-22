export const PAPER_URL =
  "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf";
export type LabId =
  "ring" | "quorum" | "versions" | "handoff" | "merkle" | "latency";
export type Chapter = {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  page: number;
  idea: string;
  blocks: { title: string; text: string }[];
  example: string;
  pitfall: string;
  terms: string[];
  lab: LabId;
  question: string;
  answer: string;
};
export const chapters: Chapter[] = [
  {
    id: "start",
    section: "Abstract · §1",
    title: "A shopping cart that keeps working",
    subtitle: "The problem that ties the whole paper together.",
    page: 1,
    idea: "A customer should still be able to add to their cart when a server or network link fails. Dynamo accepts that replicas can disagree temporarily, then gives the application a way to reconcile them.",
    blocks: [
      {
        title: "Read the paper with a running example",
        text: "Imagine the key cart:alice and a value containing Alice’s items. Several machines hold copies. A request can succeed before every copy is updated. If two people or devices edit different copies, Dynamo preserves both histories instead of silently choosing one. Keep this cart in mind as partitioning, replication, versioning, and repair are introduced.",
      },
      {
        title: "The system is a collection of tradeoffs",
        text: "Consistent hashing decides where data belongs. Replication keeps multiple copies. Vector clocks distinguish newer versions from conflicting ones. Sloppy quorums and hinted handoff keep requests moving during failures. Merkle trees and read repair help copies converge. Gossip spreads knowledge of the cluster.",
      },
      {
        title: "How to use this companion",
        text: "Follow the section numbers in the left navigation alongside the paper. Each chapter translates the mechanism, works through a concrete example, and calls out a common misreading. The adjacent lab is interactive: change a key, fail a node, or advance a version history. The glossary searches both definitions and their associated chapters.",
      },
    ],
    example:
      "Alice adds a book through node A while node B is unreachable. Later, another device adds a camera through B using an older cart. A future read can return both versions. The cart application merges their items and writes a version that descends from both.",
    pitfall:
      "This is Dynamo, the internal system described at SOSP 2007. Amazon DynamoDB is a later managed service with its own architecture and API; this guide does not describe DynamoDB configuration.",
    terms: ["Dynamo", "Eventual consistency", "Replica"],
    lab: "ring",
    question:
      "What does Dynamo ask the application to do that a conventional single-value store might hide?",
    answer:
      "Handle multiple concurrent versions and choose a meaningful reconciliation policy. For a shopping cart, merging items may be more useful than discarding one entire cart.",
  },
  {
    id: "requirements",
    section: "§2.1",
    title: "What Dynamo promises",
    subtitle: "Understand the assumptions before the mechanisms.",
    page: 2,
    idea: "Dynamo is a key-value store for small objects and single-key operations, built for Amazon’s trusted internal environment.",
    blocks: [
      {
        title: "A deliberately narrow query model",
        text: "A key identifies an opaque byte array, usually smaller than 1 MB in the target applications. Dynamo does not need joins, relational schemas, or transactions across multiple keys. Each service operates its own Dynamo instance and chooses settings for its workload.",
      },
      {
        title: "Availability, durability, and consistency differ",
        text: "Availability is whether a request can complete. Durability is whether acknowledged data survives failures. Consistency concerns what reads can observe. More replicas can help durability, but a requirement to wait for all of them can hurt availability and latency. These properties are not interchangeable.",
      },
      {
        title: "Know the operating envelope",
        text: "The paper assumes non-hostile internal participants and initially targets hundreds of storage hosts. It explicitly does not provide isolation guarantees. Its discussion of the C in ACID should not be read as a complete formal definition of distributed consistency: database invariants and consistency models are related but distinct ideas.",
      },
    ],
    example:
      "put(cart:alice, context, items) updates one object. It cannot atomically debit a bank account under one key and credit another key. A banking transaction needs guarantees beyond this interface.",
    pitfall:
      "‘Always writable’ expresses a design priority, not success with zero reachable storage. Requests can still fail if too few replicas respond before the deadline.",
    terms: ["Availability", "Durability", "ACID", "Blob"],
    lab: "quorum",
    question:
      "Does successfully writing a shopping cart mean every replica already has it?",
    answer:
      "No. The write succeeds after W acknowledgements, with N the intended replica count. Some replicas may lag, and the acknowledgement’s durability also depends on the persistence configuration.",
  },
  {
    id: "latency",
    section: "§2.2",
    title: "Why the slowest requests matter",
    subtitle: "SLAs, fan-out, and the 99.9th percentile.",
    page: 2,
    idea: "A good average can hide a bad customer experience. A page that depends on many services is exposed to each service’s slow tail.",
    blocks: [
      {
        title: "Read a percentile as a threshold",
        text: "A p99.9 latency of 300 ms means 99.9% of measured requests finish at or below 300 ms; 0.1% exceed it. It does not mean the average is 300 ms. An SLA also specifies load conditions. The paper gives an example of 300 ms at the 99.9th percentile under a peak load of 500 requests per second.",
      },
      {
        title: "Fan-out amplifies rare delays",
        text: "The paper describes page construction contacting over 150 services. If a response waits on many dependencies, a rare slow request in any one can delay the result. The lab illustrates this with independent requests; real services have correlated delays, uneven dependencies, caching, and different deadlines.",
      },
      {
        title: "Connect this to R and W",
        text: "Waiting for fewer replica responses can avoid a slow node. Dynamo still sends requests to its selected replicas, but can answer once it has enough responses. The tradeoff involves latency, consistency, availability, and durability—not latency alone.",
      },
    ],
    example:
      "If each of 150 independent calls has a 0.1% chance of being slow, the chance of at least one slow call is 1 − 0.999^150, about 13.9%. This is an illustration, not a measurement reported by the paper.",
    pitfall:
      "Do not average percentiles across services or add their p99.9 values to derive the page’s p99.9. The end-to-end distribution depends on the call graph and correlations.",
    terms: ["SLA", "Tail latency", "Percentile"],
    lab: "latency",
    question:
      "Why can a 3 ms average improvement be less informative than a 30 ms tail improvement?",
    answer:
      "The average obscures the small fraction of requests that violate a customer-facing latency target. Improvements at the tail can make more complete page requests finish within their deadlines.",
  },
  {
    id: "tradeoffs",
    section: "§2.3",
    title: "Accept writes. Reconcile later.",
    subtitle: "The design choices behind eventual consistency.",
    page: 3,
    idea: "When communication breaks, Dynamo favors accepting useful updates over requiring all replicas to agree immediately.",
    blocks: [
      {
        title: "When and who are separate questions",
        text: "Dynamo pushes conflict reconciliation toward reads so writes can proceed with limited coordination. It can remove causally obsolete versions itself, but only the application knows whether two concurrent cart edits should be merged. A simple timestamp policy is an alternative with different data-loss tradeoffs.",
      },
      {
        title: "The four design principles",
        text: "Incremental scalability means adding capacity one host at a time. Symmetry gives peers similar responsibilities. Decentralization avoids dependence on a single controller. Heterogeneity lets higher-capacity machines take more work, for example through additional virtual nodes.",
      },
      {
        title: "The partition tradeoff",
        text: "A network partition prevents some nodes from communicating. Serving both sides can produce divergent histories. Requiring a single up-to-date answer can instead make some requests unavailable. Eventual convergence requires communication to recover, repair to run, and conflicting updates to be reconciled; it is not a fixed deadline during an outage.",
      },
    ],
    example:
      "Two disconnected replicas both accept an edit based on the same cart. Neither update saw the other. A clock can reveal this concurrency, but it cannot decide which items Alice intended to keep.",
    pitfall:
      "CAP is not a blanket ‘pick any two’ menu. The tension is between consistency and availability when communication is partitioned. Dynamo also makes latency and durability tradeoffs in normal operation.",
    terms: [
      "Network partition",
      "Eventual consistency",
      "Semantic reconciliation",
      "Symmetry",
    ],
    lab: "versions",
    question:
      "Why doesn’t Dynamo simply settle all conflicts before acknowledging a write?",
    answer:
      "Requiring that agreement could block a write when other replicas are unreachable, undermining its availability goal. It preserves concurrent histories and exposes reconciliation at read time.",
  },
  {
    id: "related-work",
    section: "§3",
    title: "Where Dynamo fits",
    subtitle: "DHTs, databases, and the contribution of the paper.",
    page: 4,
    idea: "The contribution is a production-tested combination of existing techniques, not the invention of every ingredient.",
    blocks: [
      {
        title: "Peer-to-peer systems and DHTs",
        text: "Systems such as Chord and Pastry distribute key ownership through overlays, often routing through multiple hops to avoid every node knowing everyone. Dynamo’s smaller, controlled membership lets each node keep the full routing map and usually find owners directly.",
      },
      {
        title: "Distributed file systems and databases",
        text: "The paper contrasts file-oriented systems and transactional databases with its narrow key-value interface. It discusses systems such as Bayou and Coda that permit disconnected updates and later reconciliation, and Bigtable, which exposes a different data model and consistency contract.",
      },
      {
        title: "The practical distinction",
        text: "Dynamo combines incremental partitioning, application-assisted reconciliation, decentralized operation, and service-specific tuning under demanding latency targets. Table 1 is a useful map from each problem to the corresponding technique.",
      },
    ],
    example:
      "A global peer-to-peer network might avoid storing a million-entry routing table on every participant. A Dynamo instance with a few hundred trusted hosts can afford full membership to reduce routing hops.",
    pitfall:
      "A hash ring describes key placement. It does not by itself imply multi-hop routing, consensus, or any particular consistency guarantee.",
    terms: ["DHT", "Coordinator", "Membership"],
    lab: "ring",
    question:
      "Which part of the paper’s contribution would disappear if you only described consistent hashing?",
    answer:
      "How versioning, failure handling, repair, coordination, and production tuning work together to meet an application’s availability and latency needs.",
  },
  {
    id: "interface",
    section: "§4.1",
    title: "Two operations, one crucial context",
    subtitle: "get(key) and put(key, context, object).",
    page: 5,
    idea: "A read returns values plus a context. Passing that context back tells Dynamo which history your next write builds on.",
    blocks: [
      {
        title: "Read the API literally",
        text: "get(key) can return one object or multiple conflicting objects, together with metadata called context. put(key, context, object) creates a new version using that history. The application treats the context as opaque even though this guide exposes its vector-clock meaning for teaching.",
      },
      {
        title: "Bytes, keys, and hashes",
        text: "Keys and objects are opaque arrays of bytes. The original design hashes a key with MD5 to a 128-bit identifier used for placement. That hash locates the object; it is not an encryption scheme and says nothing about the semantic contents of the value.",
      },
      {
        title: "A read-modify-write cycle",
        text: "Read the cart and context, modify the application value, then write using that context. When a read returns siblings, reconcile their values and use the combined context for the write. Reusing stale context can create another branch rather than overwrite all newer history.",
      },
    ],
    example:
      "get(cart:alice) → [book], context {A:1}. A write coordinated by A with that context creates [book, camera], {A:2}. A different client still holding {A:1} has not observed that update.",
    pitfall:
      "Context is not a lock or a compare-and-swap token that guarantees rejection of stale updates. Dynamo can preserve a stale-context write as a concurrent version.",
    terms: ["Context", "Vector clock", "Siblings", "Coordinator"],
    lab: "versions",
    question: "Why send context back when the store already knows the key?",
    answer:
      "The key identifies the object. Context identifies the versions the client observed, so Dynamo can distinguish a causal successor from an independent update.",
  },
  {
    id: "partitioning",
    section: "§4.2",
    title: "Find a key on the ring",
    subtitle: "Consistent hashing and virtual nodes, step by step.",
    page: 5,
    idea: "Hash the key, walk clockwise, and find its owner. A physical host owns several positions so work can be spread more evenly.",
    blocks: [
      {
        title: "A circular address space",
        text: "Imagine every hash value placed on a circle, with the largest wrapping to the smallest. A token owns the interval from the preceding token, exclusive, through itself, inclusive. A key’s first clockwise token identifies its primary placement. Adding a token splits an existing interval instead of remapping the entire dataset.",
      },
      {
        title: "Why one token is not enough",
        text: "Random token positions make unequal intervals. Virtual nodes assign multiple tokens to one physical host, distributing its responsibility around the ring. A failed host’s load can be spread over multiple peers, and a new host can receive portions from several peers. Capacity can be reflected in token counts.",
      },
      {
        title: "Separate ownership from reachability",
        text: "A temporary failure does not remove a node from membership. Its normal ranges remain assigned; fallback replicas can temporarily handle requests. Explicitly adding or removing membership changes ownership. The ring lab’s ‘Add host F’ demonstrates a membership change, not a temporary failure.",
      },
    ],
    example:
      "With tokens at 10, 40, and 80, a key at 25 belongs to the token at 40. A new token at 30 takes only (10,30] as primary ownership. A key at 95 wraps to the token at 10.",
    pitfall:
      "A virtual node is a token/range assignment, not an extra physical machine. Three tokens on the same host are not three independent replicas.",
    terms: ["Consistent hashing", "Token", "Virtual node", "Preference list"],
    lab: "ring",
    question: "Why skip repeated host names when choosing replica positions?",
    answer:
      "Replicas must live on distinct physical hosts. Otherwise one host failure could remove multiple supposed copies, defeating the intended redundancy.",
  },
  {
    id: "replication",
    section: "§4.3",
    title: "One key, N distinct hosts",
    subtitle: "Replication and the preference list.",
    page: 6,
    idea: "The first N distinct physical hosts in a key’s preference list are its normal replica destinations. The list extends beyond N to allow fallbacks.",
    blocks: [
      {
        title: "Partitioning and replication answer different questions",
        text: "Partitioning divides the keyspace. Replication copies each partition onto several hosts. With N = 3, a key is normally stored on its owner and two clockwise successor hosts, skipping repeated virtual-node owners.",
      },
      {
        title: "A coordinator is a request role",
        text: "The coordinator handles a particular operation and contacts replicas. It is not a permanent cluster leader. The paper allows coordination by one of the top N nodes, with routing and later optimizations discussed in §4.5 and §5.",
      },
      {
        title: "Physical failure domains matter",
        text: "Distinct hosts protect against individual host failures. The paper also describes spreading replicas across data centers to survive broader failures. Merely drawing different circles does not make them independent if they share a rack, power source, or network.",
      },
    ],
    example:
      "A ring walk encounters A₁, A₂, B₁, C₁, D₁. For N = 3, the normal replicas are A, B, C. D is an alternate destination; A₂ does not count as another replica.",
    pitfall:
      "N is the intended replication factor, not the number of machines in the whole cluster and not the number of acknowledgements needed for success.",
    terms: ["N / R / W", "Replica", "Preference list", "Coordinator"],
    lab: "ring",
    question: "Why does a preference list contain more than N hosts?",
    answer:
      "If a normal replica is unreachable, Dynamo can walk farther down the list to find a healthy substitute for the operation.",
  },
  {
    id: "versioning",
    section: "§4.4",
    title: "A clock that tracks cause, not time",
    subtitle: "Recreate the D1–D5 history from Figure 3.",
    page: 6,
    idea: "A vector clock records which updates a version has seen. Comparable clocks form one history; incomparable clocks reveal concurrent branches.",
    blocks: [
      {
        title: "Compare every component",
        text: "Treat missing entries as zero. If every counter in clock X is less than or equal to its counterpart in Y, and at least one is smaller, X is an ancestor of Y. Y subsumes X. If X is ahead on one component and Y on another, neither contains the other’s history: keep both.",
      },
      {
        title: "Follow Figure 3",
        text: "D1 is {Sx:1}, then D2 is {Sx:2}. A write through Sy using D2 creates D3 = {Sx:2, Sy:1}. Another write through Sz also using D2 creates D4 = {Sx:2, Sz:1}. D3 and D4 are concurrent. Reading both and merging through Sx produces D5 = {Sx:3, Sy:1, Sz:1}.",
      },
      {
        title: "Metadata also has a cost",
        text: "If many nodes coordinate writes, clocks grow. The paper describes attaching timestamps to clock entries and dropping the oldest entry when a threshold, for example 10 pairs, is reached. This truncation can lose ancestry information and complicate reconciliation. Timestamps here help bound metadata; they do not replace vector counters as the causal comparison.",
      },
    ],
    example:
      "A merge that unions cart items preserves additions, but an item removed in one branch may survive in another and reappear. Dynamo detects the fork; the application chooses what a correct merge means.",
    pitfall:
      "A larger sum of counters or a later wall-clock timestamp does not prove that one version descends from another. Compare components, not totals.",
    terms: [
      "Vector clock",
      "Causality",
      "Siblings",
      "Syntactic reconciliation",
      "Semantic reconciliation",
    ],
    lab: "versions",
    question: "Is {A:2, B:1} newer than {A:1, B:2}?",
    answer:
      "Neither dominates the other. The first is ahead at A; the second is ahead at B. They are concurrent and must both be retained until a reconciliation policy resolves them.",
  },
  {
    id: "quorums",
    section: "§4.5",
    title: "How many replies are enough?",
    subtitle: "Trace reads and writes with N, R, and W.",
    page: 7,
    idea: "Send requests to N selected replicas. A read needs R responses; a write needs W acknowledgements, including the coordinator’s local write.",
    blocks: [
      {
        title: "Follow a write",
        text: "A load balancer may send a request to any node; it can forward it to an appropriate coordinator. A partition-aware client avoids that extra hop. The coordinator makes a new version, persists locally, and sends it to the other selected replicas. It can report success after W total acknowledgements without waiting for all N.",
      },
      {
        title: "Follow a read",
        text: "The coordinator queries the selected replicas and waits for R responses. It discards ancestors it can identify, returns concurrent versions with a context, and lets the application reconcile their values. Receiving R replies does not mean every version anywhere in the system was observed.",
      },
      {
        title: "Understand the intersection argument",
        text: "For a fixed set of N replicas, R + W > N ensures any read set of size R intersects any write set of size W. This is useful overlap, but not by itself a proof of linearizability: concurrency, version handling, partial writes, and the actual protocol still matter. Sloppy quorums can use different host sets, breaking the fixed-set premise.",
      },
    ],
    example:
      "With N = 3, R = 2, W = 2, a write acknowledged by A and B overlaps a read answered by B and C at B. With R = 1, a read answered only by lagging C can miss the update.",
    pitfall:
      "A timeout is an uncertain outcome, not proof that nothing was written. Some replicas may have persisted a version before the coordinator ran out of time.",
    terms: ["N / R / W", "Quorum", "Sloppy quorum", "Coordinator"],
    lab: "quorum",
    question:
      "Does R + W > N guarantee the latest value with Dynamo’s sloppy quorum?",
    answer:
      "No. The arithmetic assumes the same replica universe. During failures, read and write operations may use different healthy substitutes, and therefore need not intersect.",
  },
  {
    id: "handoff",
    section: "§4.6",
    title: "Borrow a healthy neighbor",
    subtitle: "Sloppy quorums and hinted handoff.",
    page: 8,
    idea: "When a normal replica is unreachable, a healthy substitute stores its copy with a note about the intended destination.",
    blocks: [
      {
        title: "Walk beyond the normal replicas",
        text: "Instead of requiring a fixed quorum of the first N owners, Dynamo uses the first N healthy hosts in the preference list. A substitute can store a hinted replica for the unavailable host. These choices depend on a node’s local view of reachability.",
      },
      {
        title: "Return the borrowed copy",
        text: "The substitute keeps hinted data in a separate local area and periodically checks whether the intended destination is reachable. When that host recovers, the substitute transfers the data and removes its temporary copy after successful delivery. This handles transient outages without an immediate ownership rebalance.",
      },
      {
        title: "Know the limits",
        text: "A hint is stored data and destination metadata, not a promise independent of hardware. If the substitute fails before handoff, another copy or anti-entropy repair is needed. If too few hosts can respond, the request still fails. Hinted handoff and eventual replica synchronization solve different parts of recovery.",
      },
    ],
    example:
      "The normal owners are A, B, C. A is unreachable, so B coordinates a write to B, C, D. D keeps a hint ‘for A’. Recover A, then deliver the hint. The lab separates these actions so you can see that recovery alone does not instantly update A.",
    pitfall:
      "Sloppy quorum is not ‘use fewer than W acknowledgements’. W still applies; the set of machines providing the acknowledgements can change.",
    terms: [
      "Sloppy quorum",
      "Hinted handoff",
      "Preference list",
      "Network partition",
    ],
    lab: "handoff",
    question:
      "Why shouldn’t a brief outage automatically remove A from the ring?",
    answer:
      "Temporary unreachability is not an explicit membership departure. Reassigning ranges for every outage would trigger unnecessary data movement; handoff lets A resume its normal role.",
  },
  {
    id: "anti-entropy",
    section: "§4.7",
    title: "Find disagreement without copying everything",
    subtitle: "Merkle trees and anti-entropy.",
    page: 8,
    idea: "Compare hashes of shared key ranges. Equal subtrees can be skipped; only mismatching branches need further investigation.",
    blocks: [
      {
        title: "Build from leaves upward",
        text: "Leaves summarize individual keys’ values. Parent hashes summarize their children, and the root summarizes the full range. Two peers with a common range exchange root hashes. Equal roots indicate matching contents, assuming the hash behaves as intended. Different roots tell you to compare children.",
      },
      {
        title: "Repair only the differing ranges",
        text: "Descend through mismatching branches to discover keys that are out of sync, then synchronize their versions. A Merkle tree locates differences; it does not tell you which concurrent value is semantically correct. Vector-clock comparison and application reconciliation still matter.",
      },
      {
        title: "Why partition boundaries matter",
        text: "Dynamo keeps a separate tree for each hosted key range. If joins and departures change range boundaries, trees must be rebuilt. Section 6.2’s fixed partitions help avoid this repeated work and make transfers and archiving easier.",
      },
    ],
    example:
      "Eight keys match except cart:6. The root differs, only the right half differs, and then only the branch containing cart:6 differs. The lab highlights that path and lets you repair the single stale value.",
    pitfall:
      "Hinted handoff returns a known temporary copy. Anti-entropy discovers differences even when no usable hint remains. Read repair is a third mechanism triggered by reads.",
    terms: ["Merkle tree", "Anti-entropy", "Read repair"],
    lab: "merkle",
    question:
      "If two Merkle roots differ, can you immediately decide which replica is newer?",
    answer:
      "No. A hash shows that contents differ. You must locate the differences and inspect version metadata; concurrent versions may require application reconciliation.",
  },
  {
    id: "membership",
    section: "§4.8",
    title: "How peers learn about the ring",
    subtitle: "Membership, seeds, gossip, and local failure detection.",
    page: 8,
    idea: "Membership is explicit and spreads through gossip. Reachability is a local observation, so two nodes can disagree about whether a peer is down.",
    blocks: [
      {
        title: "Membership changes are deliberate",
        text: "An operator explicitly adds or removes a host. The receiving node persists the change and its timestamp. Peers gossip their membership histories and token assignments, eventually learning the same map. The paper describes each node contacting a random peer every second.",
      },
      {
        title: "Seeds help peers discover one another",
        text: "If A and B start knowing only themselves, they may form separate logical rings. Seed nodes obtained through configuration provide common discovery points. They are normally fully functional storage peers, not elected leaders that approve every operation.",
      },
      {
        title: "Failure is local, not a global verdict",
        text: "A can time out talking to B even while C can reach B. This local suspicion is enough for A to avoid B and try a substitute. A periodically retries. Failure detection guides request routing; it does not require a globally agreed ‘B is dead’ decision or automatically delete B from membership.",
      },
    ],
    example:
      "A broken route between A and B can lead A to use D as a substitute while C continues talking to B. All four machines can be running. This is why a timeout and a membership removal are different events.",
    pitfall:
      "Gossip is eventual dissemination, not a consensus protocol. Knowing the current membership and agreeing on a single order of data writes are different problems.",
    terms: ["Membership", "Gossip", "Seed", "Failure detection"],
    lab: "handoff",
    question: "If A suspects B has failed, must C reach the same conclusion?",
    answer:
      "No. Reachability is local. C may still communicate with B, and Dynamo can route operations based on each node’s own observations.",
  },
  {
    id: "scaling",
    section: "§4.9",
    title: "Add capacity without moving everything",
    subtitle: "Bootstrapping and range transfer.",
    page: 9,
    idea: "A joining host takes responsibility for selected ranges, and existing replicas transfer the relevant data to it.",
    blocks: [
      {
        title: "A join has a data movement phase",
        text: "After a new host’s tokens propagate, peers identify which ranges it now owns. Existing holders transfer those keys. In the simple ring illustration with N = 3, adding X between A and B means B, C, and D may transfer relevant ranges to X as replication responsibilities change.",
      },
      {
        title: "Avoid duplicate and disruptive work",
        text: "The paper describes distributing transfers over multiple existing nodes and using confirmation between source and destination to avoid duplicate transfers for a range. Bootstrapping consumes disk, CPU, and network resources, so it must coexist with foreground requests.",
      },
      {
        title: "Read this together with §6.2",
        text: "The original random-token strategy can force expensive scans and Merkle-tree rebuilds. Fixed partition boundaries later separate the question ‘what are the pieces?’ from ‘which hosts hold them?’ The ring lab illustrates the original ownership idea, not the full production bootstrap protocol.",
      },
    ],
    example:
      "Click ‘Add host F’ in the ring lab. Compare primary owners across the same sample keys. Only intervals claimed by F move their primary owner; replica sets can change for additional keys.",
    pitfall:
      "Incremental movement is not zero movement, and moving primary ownership is not the same as counting all replica transfers.",
    terms: ["Bootstrapping", "Token", "Virtual node", "Replication factor"],
    lab: "ring",
    question:
      "Why can more replicas need updating than the keys whose primary owner changed?",
    answer:
      "Replica placement also depends on successor hosts. A new host can enter a key’s replica set even when that key’s first owner remains unchanged.",
  },
  {
    id: "implementation",
    section: "§5",
    title: "What actually runs on a node",
    subtitle: "Storage engines, request state machines, and read repair.",
    page: 9,
    idea: "A request coordinator drives a small state machine around local persistence and network messages, while background work keeps replicas healthy.",
    blocks: [
      {
        title: "Pluggable local persistence",
        text: "Dynamo combines request coordination, membership/failure detection, and a local storage engine. The paper lists Berkeley DB, MySQL, and other persistence options, selected for an application’s object sizes and access patterns. Most production instances described used Berkeley DB Transactional Data Store.",
      },
      {
        title: "An event-driven request lifecycle",
        text: "Java NIO channels and a staged event-driven design support many concurrent operations. Each request has a state machine: choose destinations, send messages, wait for enough replies or a timeout, compare versions, and package the result. This avoids treating distributed coordination as one blocking disk operation.",
      },
      {
        title: "Read repair and coordinator choice",
        text: "After responding, a read state machine briefly continues collecting outstanding replies and updates stale replicas. That is read repair. The implementation can choose the fastest responder from the previous read as the next write coordinator, spreading load and improving the chance of read-your-writes behavior. It is an optimization, not a universal session guarantee.",
      },
    ],
    example:
      "A and B return v2 quickly, satisfying R = 2. C later returns v1. The client can already have its answer while the coordinator sends v2 to C. An untouched cold key instead relies on mechanisms such as anti-entropy.",
    pitfall:
      "Read repair cannot infer application intent for two concurrent values. It can spread known versions and remove ancestors, but a semantic conflict still needs a policy.",
    terms: [
      "Read repair",
      "State machine",
      "Syntactic reconciliation",
      "Tail latency",
    ],
    lab: "merkle",
    question: "Why keep collecting replies after returning the read result?",
    answer:
      "Late replies can expose stale replicas. Repairing them opportunistically reduces future stale reads and the work left to background anti-entropy.",
  },
  {
    id: "performance",
    section: "§6.1",
    title: "Performance has a durability price",
    subtitle: "Read the production results with their assumptions.",
    page: 11,
    idea: "Dynamo’s performance depends on replication settings, object sizes, persistence behavior, and where in the latency distribution you look.",
    blocks: [
      {
        title: "Read Figures 4 and 5 carefully",
        text: "The reported experiments examine production latency and an optimization that buffers writes in memory before flushing to disk. Average latency and the 99.9th percentile are plotted separately because they can differ by an order of magnitude. These results describe the measured deployment, not a promise for every Dynamo-like system.",
      },
      {
        title: "Acknowledgement is a persistence contract",
        text: "If a replica acknowledges while data is only in a memory buffer, it is more vulnerable to crashes than a durably persisted copy. Replication can reduce exposure, but correlated failures still matter. The paper discusses durability-oriented configurations and requiring durable writes at a subset of replicas.",
      },
      {
        title: "Use N, R, and W as workload choices",
        text: "The paper describes a common configuration of (3,2,2). Smaller R can favor read availability and latency; smaller W can favor write availability and latency. Larger acknowledgement sets can improve overlap or the number of persisted copies, but impose more waiting and reduce tolerance for unreachable replicas.",
      },
    ],
    example:
      "Three acknowledgements from memory buffers are not equivalent to three disk-persisted copies. Before interpreting ‘successful write’, ask what acknowledgement means and which failure scenario is being considered.",
    pitfall:
      "The lab’s response times are invented teaching values. They are not benchmarks reproduced from Amazon’s production systems.",
    terms: ["Durability", "Tail latency", "N / R / W"],
    lab: "quorum",
    question: "Why might lowering W improve latency but weaken durability?",
    answer:
      "The coordinator can return after fewer acknowledgements. Fewer hosts may have persisted the update at that point, leaving it more exposed if those hosts fail before replication finishes.",
  },
  {
    id: "partition-strategies",
    section: "§6.2",
    title: "The ring design evolves",
    subtitle: "Three partitioning strategies, and why the differences matter.",
    page: 11,
    idea: "Separate stable partition boundaries from the changing assignment of partitions to hosts.",
    blocks: [
      {
        title: "Strategy 1: random tokens, variable ranges",
        text: "Each host gets T random tokens. Neighboring tokens define partitions, so changing membership also changes the pieces. Bootstrapping requires scans, Merkle trees may need rebuilding, and archiving is awkward because ranges vary. This is the basic ring illustrated earlier in §4.2.",
      },
      {
        title: "Strategy 2: fixed partitions, random placement tokens",
        text: "Divide the hashspace into Q equal partitions but keep T random tokens per host for placement. A partition goes to the first N distinct hosts encountered clockwise from its end. Partitioning and placement can now evolve separately. Q is chosen much larger than both N and S × T, where S is the number of hosts.",
      },
      {
        title: "Strategy 3: fixed partitions, balanced tokens",
        text: "Use Q equal partitions and assign Q/S tokens per host, maintaining balanced counts as hosts join or leave. Compared with the initial strategy, the paper reports better load balancing and more efficient bootstrapping. Partition files simplify transfer and archival; membership changes require coordination to preserve the assignment properties.",
      },
      {
        title: "Uniform keys are not uniform traffic",
        text: "Even a balanced hashspace can be overloaded by a hot key. The measured imbalance ratio is the fraction of nodes whose request load differs from the mean by more than a threshold (15% in the experiment). The paper observes less imbalance under higher load when more popular keys are accessed.",
      },
    ],
    example:
      "Think of partitions as numbered boxes and hosts as shelves. Strategy 1 changes box boundaries when shelves change. Strategies 2 and 3 keep the boxes stable and move whole boxes between shelves.",
    pitfall:
      "The basic ring lab illustrates Strategy 1 with deterministic token positions. Do not mistake its ownership picture for a simulation of all three production strategies.",
    terms: ["Partition", "Token", "Bootstrapping", "Hot key"],
    lab: "ring",
    question: "Why do stable ranges help Merkle trees?",
    answer:
      "The tree summarizes a fixed range of keys. Reassigning that range to a host does not require redefining the range boundaries and rebuilding every affected tree from differently sliced data.",
  },
  {
    id: "experience",
    section: "§6.3–6.6 · §7",
    title: "What production taught the authors",
    subtitle:
      "Conflicts, routing, background work, and the limits of the evidence.",
    page: 13,
    idea: "The hard part is making all the mechanisms coexist under real workloads, while exposing the right tradeoffs to application developers.",
    blocks: [
      {
        title: "§6.3: conflicts also come from writers",
        text: "In the profiled shopping-cart workload, 99.94% of requests saw a single version. Concurrent writers, including automated clients, contributed to divergence; failures were not the only cause. Treat these figures as observations from a specific 24-hour window, not a universal conflict probability. The listed version percentages do not provide a complete normalized distribution.",
      },
      {
        title: "§6.4: move coordination closer to the client",
        text: "A partition-aware client can avoid load balancing and forwarding hops. The reported comparison improves p99.9 latency by at least 30 ms and average latency by 3–4 ms. The cost is more sophisticated clients that must maintain and refresh membership information; the paper describes a possible 10-second stale-membership window.",
      },
      {
        title: "§6.5: protect foreground requests",
        text: "Handoff, bootstrapping, and replica synchronization compete with customer traffic. An admission controller monitors foreground latency and contention, then budgets resource slices for background work. Repair cannot simply consume all available I/O without affecting service SLAs.",
      },
      {
        title: "§6.6 and §7: success within an envelope",
        text: "The authors report successful non-timeout responses for 99.9995% of requests and no observed data-loss event in their experience. Full membership worked for a few hundred nodes, but they flag tens of thousands as a scaling challenge. The conclusion is that tunable eventual consistency can serve demanding applications when their conflict policies match the business case.",
      },
    ],
    example:
      "A background repair that makes replicas agree faster can still worsen the user experience if it saturates disks and causes foreground timeouts. Operational correctness includes both recovery and predictable service performance.",
    pitfall:
      "‘No data loss observed’ is an empirical result, not a proof that every possible failure is safe. The paper withholds some workload, outage, and absolute-rate details.",
    terms: [
      "Admission control",
      "Hot key",
      "Membership",
      "Semantic reconciliation",
    ],
    lab: "latency",
    question: "What should you be able to explain after finishing the paper?",
    answer:
      "Trace a key to its replicas; explain a successful or timed-out operation; identify causal versus concurrent versions; distinguish handoff, read repair, and anti-entropy; and justify the availability, consistency, latency, and durability tradeoffs for an application.",
  },
];
export const glossary: { term: string; definition: string; chapter: string }[] =
  [
    [
      "Dynamo",
      "Amazon’s internal, highly available key-value store described in the 2007 SOSP paper. Distinct from the later Amazon DynamoDB service.",
      "start",
    ],
    [
      "Availability",
      "The ability to complete operations despite failures. Actual success still requires enough reachable replicas and time to respond.",
      "requirements",
    ],
    [
      "Durability",
      "The ability to retain acknowledged data across failures; depends on persistence, replication, and correlated failure modes.",
      "performance",
    ],
    [
      "ACID",
      "Atomicity, Consistency, Isolation, Durability: transaction properties. Dynamo does not offer general multi-key ACID transactions or isolation.",
      "requirements",
    ],
    [
      "Blob",
      "An opaque array of bytes stored as a value. The application, rather than Dynamo, understands its contents.",
      "requirements",
    ],
    [
      "SLA",
      "Service-level agreement: a target for behavior such as latency and availability under specified workload conditions.",
      "latency",
    ],
    [
      "Tail latency",
      "The slow end of the response-time distribution, often described using p99 or p99.9 rather than the mean.",
      "latency",
    ],
    [
      "Percentile",
      "A threshold below which a specified share of measurements falls. At p99.9, 0.1% of requests are slower than that threshold.",
      "latency",
    ],
    [
      "Eventual consistency",
      "Replicas can disagree temporarily but converge as updates propagate and conflicts are reconciled, assuming communication and repair can proceed.",
      "tradeoffs",
    ],
    [
      "Network partition",
      "A communication failure separating groups of nodes. It is unrelated to a partition that divides a database’s keyspace.",
      "tradeoffs",
    ],
    [
      "Symmetry",
      "The principle that storage peers have the same basic responsibilities rather than depending on a distinguished master.",
      "tradeoffs",
    ],
    [
      "DHT",
      "Distributed hash table: a system that assigns keys to participating nodes, often with an overlay routing protocol.",
      "related-work",
    ],
    [
      "Context",
      "Opaque metadata returned by a read and supplied on a write, encoding the history that the client’s update builds upon.",
      "interface",
    ],
    [
      "Coordinator",
      "The node handling a specific request, contacting replicas and assembling responses. It is not a permanent cluster leader.",
      "quorums",
    ],
    [
      "Consistent hashing",
      "Placement on a circular hashspace so adding or removing tokens changes ownership of limited intervals.",
      "partitioning",
    ],
    [
      "Token",
      "A position in the hashspace assigned to a physical host. In the original scheme it defines a range boundary.",
      "partitioning",
    ],
    [
      "Virtual node",
      "One of multiple token/range assignments held by a physical host, helping distribute work and accommodate heterogeneous capacity.",
      "partitioning",
    ],
    [
      "Partition",
      "A piece of the keyspace assigned to hosts. Different meaning from a network partition, which is a communication failure.",
      "partition-strategies",
    ],
    [
      "Replica",
      "A stored copy of a key’s version or versions on a host. Replicas may temporarily contain different histories.",
      "replication",
    ],
    [
      "Replication factor",
      "N, the intended number of distinct physical hosts holding each key in normal operation.",
      "replication",
    ],
    [
      "Preference list",
      "An ordered list of distinct hosts for a key. Its first N are normal replicas; later hosts can serve as fallbacks.",
      "replication",
    ],
    [
      "N / R / W",
      "N is intended replica count; R is responses needed for a read; W is acknowledgements needed for a write. Each is configured for the instance.",
      "quorums",
    ],
    [
      "Quorum",
      "A response set with an intersection property. R + W > N guarantees read/write intersection only within the same fixed N-host set.",
      "quorums",
    ],
    [
      "Sloppy quorum",
      "Collecting the required responses from reachable hosts in the preference list, including substitutes outside the normal replica set.",
      "handoff",
    ],
    [
      "Vector clock",
      "Per-node counters recording causal history. Component-wise comparison distinguishes ancestors from concurrent versions.",
      "versioning",
    ],
    [
      "Causality",
      "The relationship in which one update incorporates the history of another. Independent updates may be concurrent even at different wall-clock times.",
      "versioning",
    ],
    [
      "Siblings",
      "Concurrent versions of the same object that cannot be discarded as ancestors of one another.",
      "versioning",
    ],
    [
      "Syntactic reconciliation",
      "Automatically removing versions whose vector clocks show they are ancestors of another version.",
      "versioning",
    ],
    [
      "Semantic reconciliation",
      "Using application meaning to combine or choose among concurrent values, then writing with a context that includes their histories.",
      "versioning",
    ],
    [
      "Hinted handoff",
      "A substitute stores a replica with metadata naming its intended host, then returns it when that host recovers.",
      "handoff",
    ],
    [
      "Anti-entropy",
      "Background replica synchronization that discovers and repairs differences, including those not fixed by handoff or reads.",
      "anti-entropy",
    ],
    [
      "Merkle tree",
      "A tree of hashes that lets replicas compare a shared key range and descend only into differing subtrees.",
      "anti-entropy",
    ],
    [
      "Read repair",
      "Repairing stale replicas discovered while processing a read, including through replies collected after the client response.",
      "implementation",
    ],
    [
      "Membership",
      "The set of participating hosts and their assignments, changed explicitly and propagated through gossip.",
      "membership",
    ],
    [
      "Gossip",
      "Periodic peer-to-peer exchanges that disseminate membership histories and token maps without a central controller.",
      "membership",
    ],
    [
      "Seed",
      "A known discovery peer used to help nodes find one another. Usually a normal storage host, not a consensus leader.",
      "membership",
    ],
    [
      "Failure detection",
      "Local observations of unreachable peers, used to avoid failed communication and choose substitutes.",
      "membership",
    ],
    [
      "Bootstrapping",
      "Bringing a new host into service by learning membership and receiving data for its assigned ranges.",
      "scaling",
    ],
    [
      "State machine",
      "Explicit states and transitions for a request, such as sending messages, waiting for replies, timing out, and returning versions.",
      "implementation",
    ],
    [
      "Hot key",
      "A key receiving disproportionately many requests. Evenly distributed key ownership does not eliminate concentrated traffic.",
      "partition-strategies",
    ],
    [
      "Admission control",
      "Budgeting background work based on foreground resource use and latency so repairs do not overwhelm customer operations.",
      "experience",
    ],
  ].map(([term, definition, chapter]) => ({ term, definition, chapter }));
