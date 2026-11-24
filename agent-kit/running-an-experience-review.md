---
title: Run an experience review
description: Prepare tasks and evidence for seven independent perspectives and a coordinated report.
weight: 20
params:
  doc_kind: guide
---

An experience review checks whether an interface implements principles that may support clarity, competence, autonomy, trust, expression, comfort and satisfaction. It produces evidence about design behaviour and questions for human research. It does not measure people's feelings or establish that an app creates psychological benefits.

**Scope and permission**

The review covers a named build and specific tasks. Production remains read-only. Actions that change data use an explicitly authorized test environment, disposable accounts and a reset procedure. The review does not publish to real audiences, contact people, change real account settings or modify the product. Reports exclude secrets and real personal data.

**Preparing the brief**

The run brief records the target, version, audience goals, device and input conditions, tasks, starting state, available evidence, allowed actions, reset procedure and evidence location. It also records model details, tools and comparable review budgets. Tasks describe goals rather than click paths. Missing prerequisites limit the affected assessment; they do not establish a product defect.

Use the [run brief template](https://github.com/unset-sh/agent-kit/blob/main/skills/org-experience-review/run-brief.md)
in an agent-kit checkout, or in a repository that has taken a kit commit containing the review skill:

1. Choose the real tasks and evidence to review, and fill in the brief.
2. Ask the assistant to use `org-experience-review` with that brief. If the host does not discover skills,
   provide the [coordinator instructions](https://github.com/unset-sh/agent-kit/blob/main/skills/org-experience-review/SKILL.md)
   and their linked files.
3. Read the resulting report for supported design choices, observed gaps, unassessed states and questions
   for people. Verify material gaps before implementing a proposed change.

For example, a profile review might ask the agents to create a minimal fictional profile, inspect its
visitor view and correct a mistake. This is an illustrative task set; select features the target actually supports.

**Independent perspectives**

Seven specialist agents examine orientation, competence, autonomy, trust, expression, comfort and satisfaction. An eighth agent coordinates and synthesizes their findings. Each specialist starts with a fresh context containing the brief, shared rules, report format and its own perspective. Source code, design rationale and other reviewers' reports are withheld. Parallel interaction requires isolated sessions and data; shared state requires sequential runs and a reset.

**Model calibration**

A simple control task checks screen reading and tool operation before failures are interpreted. If comparing smaller and stronger models, use the same selected perspectives and tasks, with matched tools, state and budgets. Record when calibration was not performed. Model limitations are recorded separately. A smaller model does not represent a novice person, and stronger-model success does not erase an observed obstacle.

The resulting report can be read using [Interpreting an experience review](interpreting-an-experience-review.md).
