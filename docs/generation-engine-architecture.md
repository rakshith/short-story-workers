Below is an **enhanced OpenSpec + Agent Instruction Block** you can give directly to **OpenCode / OpenWork**.
It includes the critical instruction that **existing code should be reused wherever possible** instead of rewriting everything.

This is written specifically for **AI coding agents** so they adopt the architecture while minimizing risk.

---

# OpenSpec + Agent Instruction Block

## Project: Template-Driven DAG Generation Engine (Cloudflare)

---

# 1️⃣ Objective

Refactor and organize the existing Cloudflare-based codebase into a **Template-Driven DAG Generation Engine** architecture.

The system already runs on **Cloudflare infrastructure**, but currently lacks architectural structure.

The goal is to **adopt a disciplined architecture** while **reusing as much existing code as possible**.

The agent must **avoid rewriting working components unnecessarily**.

---

# 2️⃣ Critical Instruction: Reuse Existing Code

The repository already contains working code for:

* Cloudflare Workers
* AI model integrations
* queue processing
* asset storage
* webhook handling
* generation logic

The agent **must reuse and adapt this existing logic** instead of replacing it.

Preferred strategy:

```id="8s1qae"
extract → adapt → reorganize
```

Not:

```id="mru1uv"
delete → rewrite
```

Examples:

| Existing Code       | Action                       |
| ------------------- | ---------------------------- |
| AI generation calls | move into services/providers |
| Queue workers       | adapt into executionWorker   |
| Webhook handlers    | integrate into webhookWorker |
| Asset storage logic | move into storage layer      |
| Model calls         | wrap inside provider layer   |

Existing code should be **reorganized into the new architecture**.

---

# 3️⃣ Target Architecture

The engine must follow this layered architecture.

```id="8x4h22"
Templates
   ↓
Profiles
   ↓
Composable Pipeline Blocks
   ↓
DAG Graph Builder
   ↓
5️⃣ State & Event Layer (Job Durable Object)
   ↓
6️⃣ Execution Control Layer
   ↓
Execution Workers
   ↓
Providers
   ↓
AI Models
```

This architecture allows dynamic pipelines for AI generation.

---

# 4️⃣ Infrastructure

The system runs entirely on **Cloudflare infrastructure**.

Required components:

* Cloudflare Workers
* Cloudflare Queues
* Cloudflare Durable Objects
* Cloudflare R2
* Supabase (metadata)
* Cloudflare AI Gateway (model observability)

These components already exist and should be reused.

---

# 5️⃣ Engine Module

Create a new module:

```id="j2wgyb"
src/generation-engine/
```

This module will host the new architecture.

Existing logic must be gradually migrated into this module.

---

# 6️⃣ Folder Structure

Implement the following structure.

```id="mkg8le"
src/generation-engine/

api/
templates/
profiles/
blocks/
workflow/
state/
queue/
services/
providers/
router/
webhooks/
storage/
utils/
```

Detailed files:

```id="2u3npy"
api/
  createJob.ts
  jobStatus.ts
  approveStep.ts

templates/
  registry.ts
  characterStory.ts
  youtubeShort.ts
  avatarVideo.ts

profiles/
  cinematicStory.ts
  youtubeShort.ts
  avatarPipeline.ts

blocks/
  scriptBlock.ts
  sceneBlock.ts
  imageBlock.ts
  voiceBlock.ts
  videoBlock.ts
  avatarBlock.ts
  transcriptBlock.ts
  summaryBlock.ts

workflow/
  graphBuilder.ts
  dependencyEngine.ts
  nodeExecutor.ts

state/
  jobDurableObject.ts

queue/
  executionWorker.ts
  webhookWorker.ts

services/
  scriptService.ts
  imageService.ts
  audioService.ts
  videoService.ts
  transcriptService.ts

providers/
  providerFactory.ts
  scriptProvider.ts
  imageProvider.ts
  voiceProvider.ts
  videoProvider.ts

router/
  modelRouter.ts
  circuitBreaker.ts

webhooks/
  imageWebhook.ts
  videoWebhook.ts

storage/
  assetStore.ts
  eventLogger.ts

utils/
  dependency.ts
  id.ts
  hash.ts
```

---

# 7️⃣ State & Event Layer

**Job Durable Object** manages job state and events.

Location: `src/generation-engine/state/jobDurableObject.ts`

Implementation:
- Event-driven state machine
- Persistent state across requests
- Atomic state transitions
- Async event handlers
- State change notifications

Responsibilities:

```id="x9k2lm"
Track node states (pending, running, waiting_webhook, completed, failed, timeout)
Manage dependency counters
Aggregate fan-in results
Handle retry logic and timeout detection
Emit events on state changes
Orchestrate DAG execution flow
```

Each pipeline job has one dedicated Durable Object instance.

State persistence:
- Node states
- Dependency counters
- Scheduled tasks
- Asset references
- Event history

---

# 8️⃣ Execution Control Layer

**DAG Executor** controls workflow execution.

Location: `src/generation-engine/workflow/dagExecutor.ts`

Responsibilities:

```id="b3n7qw"
Initialize DAG with dependency counters
Track execution progress
Handle node completion events
Trigger next nodes when dependencies satisfied
Coordinate parallel execution
Provide execution context to workers
```

**Dependency Engine** tracks node relationships.

Location: `src/generation-engine/workflow/dependencyEngine.ts`

Responsibilities:

```id="m2v8xp"
Calculate dependency counters
Track parent-child relationships
Handle conditional dependencies
Support dynamic dependency injection
```

**Node Executor** handles individual node execution.

Location: `src/generation-engine/workflow/nodeExecutor.ts`

Responsibilities:

```id="k4j6yt"
Resolve node type to capability
Route to appropriate service
Handle execution errors
Return execution results
```

---

# 9️⃣ Templates

Templates represent creator pipelines.

Examples:

```id="jnl7od"
character_story
youtube_short
avatar_video
```

Templates must reference profiles.

Example:

```id="2u6hnd"
character_story → cinematic_story profile
```

Templates must be registered in:

```id="q73n0d"
templates/registry.ts
```

---

# 10️⃣ Profiles

Profiles define pipeline structure.

Example cinematic pipeline:

```id="2dtz94"
prompt
↓
script
↓
scenes
↓
images
↓
voice
↓
video
```

Profiles must be composed from **pipeline blocks**.

---

# 11️⃣ Blocks

Blocks are reusable pipeline components.

Examples:

```id="u9c0ce"
scriptBlock
sceneBlock
imageBlock
voiceBlock
videoBlock
avatarBlock
transcriptBlock
summaryBlock
```

Blocks define nodes and dependencies.

---

# 12️⃣ Graph Builder

Graph builder must:

* combine blocks
* construct DAG
* calculate dependency counters
* output WorkflowGraph

Nodes contain:

```id="u3odgt"
node_id
dependencies
child_nodes
capability
```

---

# 13️⃣ DAG Execution

Execution must use **dependency counters**.

Rules:

```id="n0v0rt"
node executes when dependency_count == 0
node completion decrements child counters
```

No polling scheduler allowed.

Execution must be event driven.

> Note: This is orchestrated by the Execution Control Layer (8️⃣).

---

# 14️⃣ Job Durable Object

Create:

```id="u2f6ji"
JobDurableObject
```

Each pipeline job has one instance.

Responsibilities:

```id="gojuoy"
track node states
track dependency counters
fan-in aggregation
retry logic
timeout detection
schedule next nodes
```

Node states:

```id="w85mzb"
pending
running
waiting_webhook
completed
failed
timeout
```

> Note: This is the concrete implementation of the State & Event Layer (7️⃣).

---

# 15️⃣ Execution Workers

Queue workers execute nodes.

Flow:

```id="mhwqpf"
node scheduled
↓
execution queue
↓
executionWorker
↓
nodeExecutor
↓
service layer
```

After completion worker must notify:

```id="zztjo1"
Job Durable Object
```

---

# 16️⃣ Services

Services implement generation logic.

Examples:

```id="hb3j20"
scriptService
imageService
audioService
videoService
transcriptService
```

Services prepare model inputs.

Services must reuse existing generation logic.

---

# 17️⃣ Providers

Providers interact with models.

Providers must support:

```id="kl3ptp"
mock providers
real providers
```

All model calls must pass through **Cloudflare AI Gateway**.

---

# 18️⃣ Model Router

Router chooses providers.

Example fallback chain:

```id="r68vgd"
flux → sdxl → dalle
```

Router may select providers based on:

```id="f0i1tk"
latency
cost
availability
```

---

# 19️⃣ Circuit Breaker

Circuit breaker prevents failing providers from being used repeatedly.

Features:

```id="0x7gze"
track provider failures
open circuit after threshold
retry after cooldown
```

---

# 20️⃣ Webhooks

Some models return async responses.

Webhook flow:

```id="p99o78"
model webhook
↓
webhook worker
↓
Job Durable Object
↓
resume pipeline
```

---

# 21️⃣ Storage

Generated assets stored in **R2**.

Structure:

```id="6o3b7q"
scripts/
images/
audio/
videos/
```

Metadata stored in **Supabase**.

Tables:

```id="7pnv32"
jobs
job_assets
job_events
job_costs
```

---

# 22️⃣ Parallel Execution

Support fan-out pipelines.

Example:

```id="wkw5lj"
scene_generation
↓
image(scene1)
image(scene2)
image(scene3)
```

Use **Cloudflare Queues** for parallel execution.

---

# 23️⃣ Development Mode

Support mock providers.

Environment variable:

```id="fa7fcq"
GEN_PROVIDER=mock
```

Mock providers return placeholder outputs.

---

# 24️⃣ Migration Strategy

The agent must not break existing functionality.

Migration approach:

```id="6xy1pw"
1. create generation-engine module
2. move reusable logic into services/providers
3. integrate queue workers
4. integrate Job Durable Object
5. gradually migrate templates
```

Legacy pipelines should continue working during migration.

---

# 25️⃣ Expected Result

The final engine must support:

```id="dwui0p"
dynamic template pipelines
parallel generation
webhook models
provider routing
provider failover
AI gateway observability
```

Running on:

```id="as4g0f"
Cloudflare Workers
Cloudflare Queues
Durable Objects
R2
Supabase
AI Gateway
```

---

# 26️⃣ Implementation Rules for the Agent

The agent must:

1. reuse existing working code whenever possible
2. reorganize code into the new architecture
3. avoid unnecessary rewrites
4. maintain backward compatibility
5. implement modular TypeScript structure
6. follow Cloudflare best practices

---

# Final Note to Agent

The primary goal is **architectural discipline**, not feature expansion.

Focus on:

```id="7x5q2k"
clear layers
code reuse
modular structure
Cloudflare-native execution model
```

---

✅ This version is **optimized for coding agents** and explicitly tells them to **reuse your existing Cloudflare code while adopting the new architecture**.
