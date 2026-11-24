---
title: "How organisation defaults work"
description: "Understand the shared GitHub policies and forms, their inheritance, and their maintenance."
weight: 5
type: docs
params:
  doc_kind: explanation
  checked_source_revision: "9422ac99e93d1edd167912deae75f7eb0b9861ec"
---

`unset-sh/.github` owns the organisation profile, shared community policies, issue forms and pull-request template.
GitHub presents these defaults in other unset-sh repositories when those repositories do not provide their own
equivalent files. The defaults are maintained here; GitHub does not copy them into each repository's Git history.

This page describes the setup at `9422ac99e93d1edd167912deae75f7eb0b9861ec`. The files become available as defaults when their pull
request reaches this public repository's default branch. Repository settings and workflow adoption have their own
scope; adding a default file does not configure every repository.

## Files and responsibilities

All paths below are relative to the `unset-sh/.github` repository:

| Path | Responsibility |
| --- | --- |
| `profile/README.md` | Organisation profile and repository navigation |
| `CONTRIBUTING.md` | Accepted contribution types and DCO sign-off |
| `CODE_OF_CONDUCT.md` | Behaviour expectations, GitHub reporting routes and moderation |
| `SECURITY.md` | Private vulnerability reporting and the established security email fallback |
| `SUPPORT.md` | Documentation, questions and issue routing |
| `ACCESSIBILITY.md` | Accessibility priorities and reporting barriers |
| `.github/ISSUE_TEMPLATE/` | Bug, feature, accessibility and question forms, plus chooser configuration |
| `.github/pull_request_template.md` | General change, validation and documentation prompts |
| `.github/VULNERABILITY_REPORT.yml` | Fields for private vulnerability reports where that feature is enabled |
| `workflow-templates/` | Starter callers maintained directly for GitHub's workflow picker |

The [contribution policy](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/CONTRIBUTING.md) retains the
existing limits on outside code. Offering a feature form or a pull-request template does not expand what a
repository accepts. The [accessibility policy](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/ACCESSIBILITY.md)
provides a reporting route; it is not a conformance assessment.

## How GitHub selects a default

For supported files that allow several locations, GitHub looks in a repository's `.github/`, root and `docs/`
directories, in that order. If the repository has no matching file, GitHub looks in this public `.github`
repository using the same precedence. A local policy therefore takes precedence over the organisation default.

Issue forms have a broader override boundary: if a consuming repository defines valid issue templates or
configuration in its own `.github/ISSUE_TEMPLATE/`, GitHub uses that repository's set instead of any part of the
organisation set. For example, adding only a local `config.yml` also stops the shared forms from appearing there.
See [GitHub's default-file rules](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file).

Shared forms avoid labels, assignees, projects and issue types that may not exist in a consuming repository.
Links to central policies are absolute, so they resolve from inherited forms. The issue chooser offers a question
form as well as bug, feature and accessibility forms; ordinary blank issues are disabled.

## Public and private reporting

Public forms ask for only the information needed to understand a problem and remind reporters to remove secrets
and personal data. A suspected vulnerability belongs in the affected repository's private reporting channel when
available, or at `security@unset.sh`, following its security policy. The custom vulnerability form does not enable
private reporting; that is a separate repository setting.

Conduct concerns use GitHub's reporting tools, as described in the
[code of conduct](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/CODE_OF_CONDUCT.md). Reporting to
GitHub Support and reporting to repository administrators are separate options; the latter appears only where
enabled. The organisation does not publish a separate conduct mailbox or promise a support response time.

## Files that are not inherited settings

`CODEOWNERS` in this repository assigns reviews for this repository only. Each repository supplies its own
licence and any local code ownership or dependency-update configuration. This repository uses Renovate, so it
does not also configure Dependabot version updates.

Shared implementations live in `unset-sh/tooling` and require explicit callers, as explained in
[Use the starter workflow templates](workflow-templates.md). The templates here help a repository install a caller;
they do not automatically enable workflows across the organisation.
Repository permissions, rulesets, required checks, deployment environments and private vulnerability reporting
are settings to configure and verify in their own scope.

This repository runs map validation on pull requests and pushes to `staging` and `main`. Its separate
`policy / Validate branch policy` caller checks PR branch relationships through pinned tooling, including
retargeted PRs. The caller has read-only permissions and does not publish. Required-check settings are rolled
out separately; existing publishing workflows and schedules are unchanged.

There is no funding configuration without an established funding destination. Discussion forms are also absent
while Discussions is disabled here. Add either feature when its actual destination and operating process exist.

## Maintain and verify the defaults

Alex owns the organisation defaults. Review them when contribution rules, contact routes or repository ownership
change, and check their links and repository settings at least every six months. Changes belong in a pull request
with the relevant human guide updated in the same change. AI working notes and validation artifacts belong in
`unset-sh/agent-kit`.

Run `bun run check` for the repository's map checks. Shared execution and release checks run in `unset-sh/tooling`. For a form change, also parse
the YAML and compare its fields with GitHub's [form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)
and [private-report form contract](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
The repository check alone does not prove that GitHub renders a new form correctly.

After merge, inspect the issue chooser in this repository and one consuming repository with no local templates.
Preview a form without submitting a test issue. Check the inherited policy links and PR template in the same way.
Inspect the Security tab separately: private reporting must be enabled before its form can be used. GitHub falls
back to its built-in private report form if a custom form is invalid.

If a default is missing, check its path, the default branch, repository visibility and local overrides first.
Correct invalid forms in their source. A reviewed revert can restore an earlier default without changing issue
history or another repository's own files.

## Source and publication

The policies, forms and template are in [the checked source tree](https://github.com/unset-sh/.github/tree/9422ac99e93d1edd167912deae75f7eb0b9861ec).
This explanation lives in `docs/site/` and is exported into `unset-sh/docs:github/` with its source revision and
hashes. See [Export the public documentation](export-docs.md) for the separate import and publication steps.
