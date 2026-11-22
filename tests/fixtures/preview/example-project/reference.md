---
title: Example record reference
description: The exact fields used by the illustrative note example.
weight: 30
params:
  doc_kind: reference
---

This reference describes the example on [Schemas describe records](schemas.md), not a published unset.sh schema.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `$type` | String | Identifies `com.example.note` |
| `text` | String | Required note text |

## Invalid examples

The example's `text` property cannot be omitted or replaced with a number. Other constraints belong to the actual protocol and schema implementation; this table is not a complete validator.

## Sources

The [Lexicon specification](https://atproto.com/specs/lexicon) defines the schema language. The [repository specification](https://atproto.com/specs/repository) describes public account records and storage.
