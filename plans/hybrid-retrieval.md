# Hybrid retrieval: exact names stop depending on semantic neighbourhoods

## Why

Retrieval is dense-only. `llama_engine.py` builds `QdrantVectorStore(..., enable_hybrid=False)` and
queries `VectorStoreQueryMode.DEFAULT` — no sparse vectors, no BM25.

For a system whose job is naming specific partner products, that is the wrong default. "Dext",
"Zone & Co", "HighRadius" are short proper nouns in crowded regions of the embedding space, and
dense similarity has no way to insist on a literal string. The visible form was
`InvalidOperationException: Blog names 4 of 5 partner tools. Missing: Dext` — though in that case
the underlying cause was that Dext had no indexed crawl at all, which is exactly the ambiguity
hybrid retrieval removes: with a lexical channel, "nothing matched the literal name" and "nothing is
indexed" stop looking alike.

Jeff, 2026-09-23, when offered a cheaper partial fix: *"Cheaper? Look how much time we've wasted."*
Half-measures are what cost that day. This is the whole change.

## What already exists

More than the `enable_hybrid=False` flag suggests.

| Piece | State |
|---|---|
| `qdrant-client>=1.19.0`, `llama-index-vector-stores-qdrant>=0.10.3` | Both support sparse natively |
| Reranker | **Fully implemented** (`rerank.py`, wired at `query.py:185`), constructed disabled: `Reranker(None, enabled=False)` |
| `rerankScore` on the response | Real, populated when the reranker is on |
| `lexicalScore` on the response | Declared, hardcoded `None` in `query.py` — the one genuine placeholder |
| `retrieval_policy_version` | Already stamped `"crawler-hybrid.v2"` |

## What is missing

1. **No `fastembed` dependency.** LlamaIndex's `enable_hybrid=True` sources sparse vectors from
   fastembed by default, so this is a new dependency and a model download at process start.
2. **The collection cannot hold sparse vectors.** `qdrant_store.ensure_collection` creates one
   unnamed dense vector:

   ```python
   vectors_config=qm.VectorParams(size=self._vector_size, distance=COSINE, on_disk=True)
   ```

   There is no `sparse_vectors_config`, and that is create-time schema in Qdrant. It cannot be added
   to `geek_crawler_chunks` in place.

## The real constraint, and it is not cost

The Hostinger box runs Mongo and Qdrant together on 7.7 GB. The 2026-09-15 audit found Mongo at
**3.62/4 GiB (90.6%) at idle** with the host actively swapping 1.2 GB, and container limits summing
to ~9.25 GB — overcommitted. Docker limits are ceilings, not reservations, so a spike in both at
once invites the host OOM-killer regardless of either container's own cap.

So the danger in re-embedding 168,391 points is not the bill. It is that the box falls over, and
takes the corpus with it.

## Shape: a versioned collection, never a migration in place

`qdrant_collection` is already a settings value (`config.py:16`), which makes this tractable.

1. **New collection**, `geek_crawler_chunks_v2`, created with both dense and sparse vector configs.
   The live one is untouched throughout.
2. **Dual write** behind a setting. Indexing writes to whichever collections the config names, so
   new crawls populate v2 while v1 keeps serving.
3. **Backfill run by run**, smallest first, using the same `find_smallest_content_ready_run`
   ordering the indexer already has. One run at a time, with the box watched between runs — not a
   single sweep over 168k points.
4. **Cut over by pointing `qdrant_collection` at v2.** One setting. Reversible by pointing it back,
   which is the property that makes this safe to attempt at all.
5. **Drop v1** only once v2 has served for a while.

## Sequencing note

Enabling hybrid and enabling the reranker are separate switches, and they should be flipped
separately. The reranker is already built and off; turning it on is a config change with no schema
implication, and it is worth measuring on its own before sparse vectors are added underneath it —
otherwise two changes land together and neither can be attributed.

## Not in scope

Chunking, the corpus format, and the dense embedding model all stay as they are. This adds a lexical
channel beside the dense one; it does not reopen how text is produced or split.
