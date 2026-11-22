---
title: Read the example record
description: Follow a small example from its identifier to its fields.
weight: 20
params:
  doc_kind: tutorial
---

The [schema explanation](schemas.md) introduces an illustrative note record. This exercise needs no account or server; you only need to read JSON.

## Inspect the record

```json
{
  "$type": "com.example.note",
  "text": "Hello."
}
```

1. Read `$type`. It identifies the example schema, `com.example.note`.
2. Find `text`. Its value is the string `Hello.`.
3. Compare the value with the [schema's required field](schemas.md#worked-example).

## Check your understanding

Would `"text": 42` meet this example's schema? It would not: `42` is a number, while the field requires a string. Omitting `text` would also violate the required-field rule.

The [reference](reference.md) gathers these constraints in one place.
