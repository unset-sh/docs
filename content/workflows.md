---
title: Workflow map
description: See what triggers each repository's automation, which shared workflows it calls, and what jobs depend on.
type: docs
weight: 15
params:
  doc_kind: reference
---

This map reads workflow configuration from the public `unset-sh` repositories. Follow a call to its workflow entry, then open that entry for events, job dependencies, declared permissions, environments and the exact source file. The [organisation map](organisation.md) explains which repository owns each responsibility.

Each described workflow also explains its purpose, the work it performs and what it produces. These explanations are maintained in tooling against an exact workflow-file digest. When the YAML changes, the map marks its description for review instead of treating the old explanation as verified. A newly discovered workflow appears even if its description has not been written yet. Read the [workflow reference](https://docs.unset.sh/tooling/workflow-reference/) for the maintained descriptions and their source revisions.

## Reusable workflow calls

Each arrow runs from a caller job to the workflow named in that job's `uses` field. A **default branch** label identifies the revision collected for that repository. A **referenced revision** is a different commit still required by a caller's pin. Both can appear for the same workflow file; changing the default branch does not change an older pin.

Calls within the same repository use the caller's exact commit. A tag or branch reference is resolved to a commit when collected. External targets remain labelled and are not fetched. Step actions such as `actions/checkout` are not reusable workflow calls.

{{< workflow-map part="calls" >}}

## Workflow catalogue

The catalogue includes repositories with no workflows, empty repositories and archived repositories. Each source link is pinned to the commit inspected. Open a workflow to inspect its job definitions; `needs` gives the declared ordering dependencies. The list itself does not imply execution order.

{{< workflow-map part="catalogue" >}}

## Read configuration and delivery separately

This is a configuration map, not a run-status dashboard. A trigger does not prove that a run succeeded; a declared environment does not prove that required reviewers or secrets are configured. Permissions shown here are the values declared in the workflow and job. Their effective values also depend on GitHub's settings and the calling chain. Expressions remain expressions rather than guessed results.

The call graph covers reusable workflow invocations. It does not infer package adoption, artifact transfers, Pages publication or cross-repository writes from shell commands. Read [how updates reach the docs](updates.md) for those delivery paths, and the [tooling workflow layout](https://docs.unset.sh/tooling/workflow-layout/) for the maintained shared entry points. Repository-specific workflow sources remain the authority for their individual steps and outputs.

## Automatic refresh

The site publication workflow calls the shared map refresh workflow on pushes to `main`, manual runs and its hourly schedule. This map and the organisation map are registered in `.github/maps.json`; new maps join the same refresh path. Every generator must succeed before one complete snapshot is passed to the site build. Read the [shared refresh guide](https://docs.unset.sh/tooling/map-refresh/) for the registration contract. The collector in `tooling` discovers public repositories, resolves each default branch once, reads the workflow files at that commit, then follows reusable calls at their actual revisions. It executes no repository workflow code. New public repositories and changed workflow files appear on the next successful publication.

The page records its collection time and source revisions. GitHub schedules may be delayed or disabled after inactivity, so an hourly schedule is not a freshness guarantee. A failed collection or validation stops publication and leaves the previously published site available. See [GitHub's schedule behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Local and pull-request builds validate a committed snapshot without network access. Do not hand-edit the generated catalogue. To investigate stale data, compare its collection time with the latest [site run](https://github.com/unset-sh/docs/actions/workflows/site.yml), inspect the failed refresh or validation step, and rerun the site workflow after correcting the source or API problem. A manual run uses the same checks.
