---
title: Interpret an experience review
description: Use implementation evidence and emotional hypotheses to plan fixes and human research.
weight: 30
params:
  doc_kind: explanation
---

An experience review separates what happened in the tested interface from what a person might feel. “The saved value disappeared after reload” is an observation. “This could reduce confidence” is a hypothesis requiring human evidence.

**Reading coverage**

Every criterion has one status and a reason:

- **Supported:** direct evidence meets the criterion in the tested scope.
- **Mixed:** observed states include both support and contradiction.
- **Gap observed:** an observed problem contradicts the criterion.
- **Not assessed:** the necessary state, interaction or evidence was unavailable.
- **Not applicable:** the criterion does not apply, with an explanation.

Missing material is not a gap. Screenshots alone cannot establish persistence, keyboard operation or recovery. A specification describes intended behaviour, not a verified interaction.

**Impact and uncertainty**

Findings identify the task, starting state, action, result and evidence reference. Critical impact concerns observed serious exposure or irreversible loss; High concerns a blocked task or materially misleading outcome. Medium describes recoverable friction, and Low describes minor issues. Supporting evidence receives No issue; insufficient evidence remains Unrated. Emotional hypotheses alone cannot justify high severity.

Confidence describes the observation's reliability, not statistical confidence or the likelihood of a feeling. Model/tool failures remain separate from implementation problems. Agreement between agents does not establish how common an issue is among people.

**Deciding what follows**

The synthesis preserves effective choices, prioritises evidenced gaps, retains disagreements and lists untested states. Recommendations trace to observations and propose changes worth testing. There is no required issue count or overall emotional score.

Human follow-up uses realistic tasks and neutral questions that could contradict the predicted effect. After changes, affected tasks are reviewed again. Readiness applies only to the proposed human-study tasks; it is not security certification, accessibility certification or release approval.
