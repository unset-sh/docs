---
title: Start here
description: Find your way through the docs, AT Protocol and the Matrix chat design.
type: docs
weight: 1
menus:
  main:
    weight: 1
params:
  doc_kind: overview
---

These docs help you use unset.sh projects and understand their code, architecture and boundaries. Start with
[All documentation](all-docs.md) to see what is available, or the [organisation map](organisation.md) to find which
repository owns a responsibility. Within a project, choose **Learn and use** for practical guides and worked
examples, or **Understand and contribute** for concepts and implementation boundaries.

Project pages come from their owning repositories. The app currently sits outside the organisation and appears as
context in the map; its documentation is not published here.

## Projects

Each project's documentation comes from its own repository. The top menu keeps to site-wide pages, so start a
project from here or from [All documentation](all-docs.md).

{{< project-list >}}

## A little AT Protocol

AT Protocol, often called **atproto**, is a protocol for open social applications. It separates account identity,
structured data and application behavior. The [official overview](https://atproto.com/guides/overview) introduces
these building blocks and the services connecting them.

**Identity:** a **DID** is an account's stable identifier. A **handle** is its readable, domain-shaped name, such as
`maya.example.com`, and can change. Applications resolve the handle to the DID to identify the account.
[Identity guide](https://atproto.com/guides/identity).

**Records and Lexicons:** a record is structured data with a named type. A **Lexicon** defines record types and API
contracts, including fields and constraints. Sharing a format gives applications a basis for understanding the
same data. [Lexicon guide](https://atproto.com/guides/lexicon).

**Hosting and interpretation:** a **Personal Data Server (PDS)** hosts an account and manages its data repository.
Applications implement the record types and behavior they support; storing a record does not guarantee that every
application displays it. [Protocol specification](https://atproto.com/specs/atp#protocol-structure).

## An illustrative example

Imagine a bookmarking app where Maya saves a title and URL. Its Lexicon defines those fields, and her PDS hosts
the record. A reading app supporting that record type could display the title as a link. The schema describes
the data; the application supplies that reading experience. This hypothetical example illustrates the boundaries.

## Matrix for chat

Matrix is the protocol selected for unset.sh's chat design, on the separate `unset.cc` origin. The
[domain decision](https://github.com/Undefined6799/unset/blob/9817f1e7ed51fdd5989d6bad6261a9e167d97b80/docs/human/decisions/0025-public-domains.md)
records that boundary.

Matrix represents conversations as rooms containing events, including messages. Clients send and synchronize events
through a homeserver. See the [Matrix introduction](https://matrix.org/docs/) and
[room model](https://spec.matrix.org/latest/#room-structure).

In this design, AT Protocol handles account identity and profile records; Matrix supplies the room and message
protocol. There is no separate messaging repository: server-side messaging belongs to `unset-sh/backend` and
its screens to `unset-sh/web`, as the [organisation map](organisation.md) shows.

For implementation details, continue with the [protocol specifications](https://atproto.com/specs/atp) and the
source references beside each project's explanations.
