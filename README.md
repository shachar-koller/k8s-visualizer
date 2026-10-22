vibe coded k8s visualizer

## Dynamo paper companion

Switch between **Kubernetes** and **Dynamo** in the sidebar, or open `/dynamo` directly. DynamoScope is a companion to DeCandia et al., *Dynamo: Amazon’s Highly Available Key-value Store* (SOSP 2007), not a guide to the later DynamoDB service.

- 18 chapters follow the paper’s sections, including assumptions, related work, the system interface, partitioning, replication, vector clocks, quorums, failure recovery, membership, implementation, and production lessons.
- Six interactive labs explore consistent hashing and virtual nodes, response thresholds, the D1–D5 version history, hinted handoff, Merkle-tree comparison, and tail-latency amplification.
- 41 searchable glossary definitions link back to their related chapters. Each chapter includes examples, distinctions, expandable definitions, and a self-check with a revealed explanation.
- Direct chapter and lab links use URL fragments, for example `/dynamo#versioning` and `/dynamo#lab-handoff`, with browser back/forward support. Reading progress is saved in browser local storage; lab state is temporary and resettable.
- On wide screens the lab stays beside the explanation. On smaller screens, use **Try the interactive lab** to expand it above the reading text. Both workspaces remain available through mobile navigation.

Content is paraphrased from the [original paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf), with links to relevant PDF pages. The labs explicitly label their simplifications: a small deterministic hash and fixed tokens (not MD5), illustrative response times, a scripted single-host outage, a known stale ancestor for Merkle repair, and independent dependency probabilities for latency. They do not implement a production Dynamo cluster or all three placement strategies.

Dynamo source lives in `src/lib/dynamo/` (content, pure teaching models, tests), `src/components/dynamo/` (workspace and labs), and `src/app/dynamo/` (route and styles). `npm test` runs both Kubernetes and Dynamo model tests.
