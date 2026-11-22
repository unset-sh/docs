---
title: Schemas describe records
description: A schema sets the rules. A record carries the data.
weight: 10
params:
  doc_kind: explanation
---

## Explanation

Lexicon is AT Protocol's schema language. It describes records, HTTP endpoints, and event messages. A record schema names the fields and says which values they accept. See the [Lexicon specification](https://atproto.com/specs/lexicon).

A record is one instance of that shape. An account's repository holds its public records. Its Personal Data Server (PDS) is the authoritative home of that repository. See the [repository specification](https://atproto.com/specs/repository).

{{< flow title="From schema to stored record" caption="The schema defines the record's shape; the account repository stores the record." >}}
1. **Schema** — defines the shape.
2. **Record** — contains one set of values.
3. **Account repository** — stores the public record.
{{< /flow >}}

## Worked example

This illustrative note is not an unset.sh record. It has one required field: `text`, a string.

```json
{
  "lexicon": 1,
  "id": "com.example.note",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text"],
        "properties": {
          "text": { "type": "string" }
        }
      }
    }
  }
}
```

`required` makes `text` mandatory. Its `type` requires a string value. A record with that shape looks like this:

```json
{
  "$type": "com.example.note",
  "text": "Hello."
}
```

## What the result means

`$type` identifies the schema. If `text` is missing or contains a number, the record does not meet the rules above. This example explains the data shape; it does not submit a record or demonstrate a complete validation implementation.

Continue with [reading the record](read-a-record.md), or consult the [field reference](reference.md#fields).
