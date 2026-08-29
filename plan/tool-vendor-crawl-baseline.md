# Tool vendor crawl — baseline commits (before wiring fix)

Clean `main` HEAD on both repos **before** the vendor crawl wiring fix work (home crawl, URL-only API, step 3 read-only, `OwnerUserId` migration). Use these to diff or reset if needed.

Recorded: 2026-08-29.

## content-creator-v2

| | |
|---|---|
| **Branch** | `main` |
| **Full** | `b7c590357f6554597c978458ba105d0d485f0844` |
| **Short** | `b7c5903` |
| **Message** | Replace tool source crawl polling with SignalR live progress. |
| **Date** | 2026-08-29 13:54:20 -0400 |

Prior crawl UI commit (create-flow step 3 POST): `8912e1e` — Add tool source crawl UI on create flow and Sources panel styling.

## GeekBackend

| | |
|---|---|
| **Branch** | `main` |
| **Full** | `f7d168106250bc90683740f9983c074433d1f4bc` |
| **Short** | `f7d1681` |
| **Message** | Push tool source crawl progress over SignalR with per-origin updates. |
| **Date** | 2026-08-29 13:54:19 -0400 |

Prior crawl backend commit: `bd94725` — Add background tool source crawl with HTML persist and tool job gates.

## Reset (if needed)

```bash
# Frontend — discard uncommitted wiring fix
cd /Users/jeffmartin/development/content-creator-v2
git checkout b7c590357f6554597c978458ba105d0d485f0844

# Backend — discard uncommitted wiring fix
cd /Users/jeffmartin/development/GeekBackend
git checkout f7d168106250bc90683740f9983c074433d1f4bc
```

## Related plan

Cursor plan: `Tool crawl wiring fix` (`edd105f6`) — vendor crawl by URLs only, no `CreateId`, home starts crawl, step 3 read-only.
