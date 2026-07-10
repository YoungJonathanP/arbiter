---
id: 2026-07-05-agent-heron-2c91-quickstart-blocked
item: onboarding-doc-refresh-2026q3
base: sha256:a000faa7bad60f7aa1c202be0f1a2818cee43c5c407e11e19c9bec03c612f91d
author: agent-heron-2c91
updated: 2026-07-05T17:20
ops: ['mark: ^quickstart = blocked']
---

# Quickstart cannot close yet: its setup steps change under the staging migration

The quickstart's database setup section documents the pre-migration connection flow. When [Staging DB migration](tasks/staging-db-migration-2026q3.md) lands, those steps change (new pooled connection string), so a quickstart shipped now would be wrong for the next hire on day one. Blocker: [Staging DB migration](tasks/staging-db-migration-2026q3.md). Staged because a proposal was already pending on this item — staging is sticky.

<!-- arbiter:staged · PROTOCOL.md#arbitration · pending proposal: while any pends, every writer stages — do not edit the item directly -->
