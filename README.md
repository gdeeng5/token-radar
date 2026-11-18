# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/gdeeng5/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/gdeeng5/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: ranks 150 pre-token DeFi protocols by implied value. The model calibrates each category's multiple on the snapshot's own live market — the median market-cap-to-TVL ratio of that category's live-token protocols — then scores every protocol from its TVL, 7-day growth, tenure with no token, and chain breadth. The board covers all 40 watchlist protocols plus 110 early pre-token protocols below the $50M floor, each with a concrete 7-step farm plan (costs and times included). The dashboard is a static, no-network page: sortable and filterable, with a per-protocol detail view showing the full model breakdown, and the 24 live-token protocols set aside with their market values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22+ required, standard library only. The program reads the sealed DefiLlama snapshot from `/input/snapshot.json` (or `--input <snapshot.json|directory>`), writes `board.json` (150 ranked rows), a static `dashboard/`, three `screenshots/`, and `dossier.json`. It is fully deterministic: two runs write byte-identical outputs.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
