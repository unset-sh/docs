---
title: Agent kit
description: Shared assistant guidance and experience review methods for unset.sh projects.
type: docs
cascade:
  type: docs
menus:
  main:
    weight: 90
params:
  doc_kind: overview
---

Agent kit holds the shared rules, skills and reviewer perspectives used by assistants working on unset.sh projects. A repository adopts the kit as a pinned copy of one reviewed commit of `main`; the source remains in agent-kit.

**Learn and use**

- [Understand the experience review](experience-review.md): the seven questions about clarity, control, trust and other aspects of using an app.
- [Run an experience review](running-an-experience-review.md): choose tasks, prepare evidence and work through a review.
- [Interpret the findings](interpreting-an-experience-review.md): distinguish implementation evidence from hypotheses about people's feelings.
- [Adopt or update the kit](https://github.com/unset-sh/agent-kit/blob/main/README.md): how a repository installs the kit and takes a newer commit.

**Understand and contribute**

- [Review responsibilities and boundaries](experience-review.md): how the seven perspectives and coordinator work together.
- [Research foundations](research-foundations.md): the evidence and expert guidance behind the questions.
- [Review skill source](https://github.com/unset-sh/agent-kit/blob/main/skills/org-experience-review/SKILL.md) and [reviewer prompts](https://github.com/unset-sh/agent-kit/tree/main/skills/org-experience-review/perspectives): change the instructions in their owning repository.

The review identifies design choices worth preserving, concrete implementation gaps and questions for a later human study. It does not replace research with people or establish that an interface produces a particular feeling.

These pages are maintained in agent-kit's public `docs/` source. They are intended for the `agent-kit/` section of the documentation site. Export and publication are separate from installing the assistant kit; adding these pages does not activate a publishing job.
