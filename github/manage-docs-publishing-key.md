---
title: "Find the documentation publishing-key guide"
description: "Locate the maintained guide for documentation publishing credentials in developer tooling."
weight: 16
type: docs
params:
  doc_kind: guide
---

The maintained [documentation publishing-key guide](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/docs/site/manage-docs-publishing-key.md)
now lives in `unset-sh/tooling`, alongside the shared documentation-export implementation. It covers owner-authorised
setup, verification, rotation and retirement, and preserves the observed `profile-recipes` publication and website-cutover evidence.

Alex owns that credential lifecycle. Moving the guide does not authorise a new key or alter an existing publisher.
This repository's [documentation export](export-docs.md) uses a read-only token to upload an artifact and does not need
a cross-repository publishing key.
