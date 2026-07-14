"""
LILA Player Journey - Data Preprocessing Pipeline

Reads all raw .nakama-0 (parquet) files, validates/cleans them, and emits a
compact columnar dataset the frontend can load and filter entirely client-side.

Design notes (see ARCHITECTURE.md for the full writeup):
- user_id/match_id/map_id/event are dictionary-encoded (repeated strings -> int
  indices) because they repeat heavily across ~89k rows.
- is_human is derived from user_id shape (UUID regex), NOT from the event name
  prefix, because a handful of bots emit non-Bot-prefixed events (see below).
- Coordinates are stored as raw world x/z (float32) with NO minimap pixel
  conversion baked in. Pixel conversion happens in the frontend using the
  per-map scale/origin from the README, so the transform is never hardcoded
  and stays inspectable/testable in one place (mapCoords.ts).
- Output is split by day to enable progressive loading, plus a merged
  matches index and a global insights.json.
"""
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
import os
import re
import json
import sys

RAW_DIR = "../../player_data" if os.path.basename(os.getcwd()) == "scripts" else "player_data"
OUT_DIR = "../public/data" if os.path.basename(os.getcwd()) == "scripts" else "public/data"

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

# Per-README map configuration. Never hardcoded downstream of this file.
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473, "image": "AmbroseValley_Minimap.png"},
    "GrandRift":     {"scale": 581, "originX": -290, "originZ": -290, "image": "GrandRift_Minimap.png"},
    "Lockdown":      {"scale": 1000, "originX": -500, "originZ": -500, "image": "Lockdown_Minimap.jpg"},
}

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def is_human_id(user_id: str) -> bool:
    return bool(UUID_RE.match(str(user_id)))


def load_day(day: str) -> pd.DataFrame:
    folder = os.path.join(RAW_DIR, day)
    frames = []
    skipped = []
    for fn in os.listdir(folder):
        if fn.startswith("."):
            continue
        fp = os.path.join(folder, fn)
        try:
            df = pq.read_table(fp).to_pandas()
        except Exception as e:
            skipped.append((fn, str(e)))
            continue
        df["event"] = df["event"].apply(lambda x: x.decode("utf-8") if isinstance(x, bytes) else x)
        # match_id in the data still carries the .nakama-0 suffix per the README sample row;
        # strip it so match_id is a clean join key.
        df["match_id"] = df["match_id"].astype(str).str.replace(r"\.nakama-0$", "", regex=True)
        frames.append(df)
    if skipped:
        print(f"  [warn] {day}: skipped {len(skipped)} unreadable files", file=sys.stderr)
    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, ignore_index=True)
    out["day"] = day
    return out


def build_dict(values):
    """Dictionary-encode a pandas Series -> (list of unique strings, int codes)."""
    cats = pd.Categorical(values)
    return list(cats.categories), cats.codes.tolist()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_days = []
    for day in DAYS:
        print(f"Loading {day}...")
        df = load_day(day)
        if df.empty:
            continue
        df["is_human"] = df["user_id"].apply(is_human_id)
        all_days.append(df)

    full = pd.concat(all_days, ignore_index=True)
    print(f"Total rows: {len(full)}")

    # Flag the known data-quality edge case rather than silently "fixing" it:
    # a small number of bot rows carry non-Bot-prefixed event names.
    bot_rows = full[~full["is_human"]]
    mislabeled = bot_rows[~bot_rows["event"].isin(["BotPosition", "BotKill", "BotKilled"])]
    print(f"Bot rows with non-standard event names (kept, classified by user_id not event name): {len(mislabeled)}")

    # ---- Per-day columnar export ----
    event_dict_global = sorted(full["event"].unique().tolist())
    event_index = {e: i for i, e in enumerate(event_dict_global)}

    match_meta = {}  # match_id -> {map_id, day, players: set, start_ts, end_ts}

    for day in DAYS:
        day_df = full[full["day"] == day]
        if day_df.empty:
            continue

        user_dict, user_codes = build_dict(day_df["user_id"])
        match_dict, match_codes = build_dict(day_df["match_id"])

        payload = {
            "day": day,
            "userDict": user_dict,
            "matchDict": match_dict,
            "eventDict": event_dict_global,
            "n": len(day_df),
            "userIdx": user_codes,
            "matchIdx": match_codes,
            "mapId": day_df["map_id"].tolist(),
            "x": np.round(day_df["x"].astype(float), 2).tolist(),
            "z": np.round(day_df["z"].astype(float), 2).tolist(),
            "y": np.round(day_df["y"].astype(float), 2).tolist(),
            "ts": day_df["ts"].astype("int64").tolist(),  # ms epoch encoding of in-match elapsed time
            "eventIdx": [event_index[e] for e in day_df["event"]],
            "isHuman": day_df["is_human"].tolist(),
        }
        with open(os.path.join(OUT_DIR, f"{day}.json"), "w") as f:
            json.dump(payload, f)
        print(f"  wrote {day}.json ({len(day_df)} rows, "
              f"{os.path.getsize(os.path.join(OUT_DIR, f'{day}.json'))/1024:.0f} KB)")

        # accumulate match metadata
        for (match_id, map_id), g in day_df.groupby(["match_id", "map_id"]):
            key = match_id
            if key not in match_meta:
                match_meta[key] = {
                    "matchId": match_id, "mapId": map_id, "day": day,
                    "startTs": int(g["ts"].astype("int64").min()),
                    "endTs": int(g["ts"].astype("int64").max()),
                    "humans": set(), "bots": set(),
                }
            m = match_meta[key]
            m["startTs"] = min(m["startTs"], int(g["ts"].astype("int64").min()))
            m["endTs"] = max(m["endTs"], int(g["ts"].astype("int64").max()))
            humans = set(g.loc[g["is_human"], "user_id"])
            bots = set(g.loc[~g["is_human"], "user_id"])
            m["humans"] |= humans
            m["bots"] |= bots

    # ---- matches index ----
    matches_out = []
    for m in match_meta.values():
        matches_out.append({
            "matchId": m["matchId"],
            "mapId": m["mapId"],
            "day": m["day"],
            "startTs": m["startTs"],
            "endTs": m["endTs"],
            "durationMs": m["endTs"] - m["startTs"],
            "numHumans": len(m["humans"]),
            "numBots": len(m["bots"]),
        })
    matches_out.sort(key=lambda r: (r["day"], r["mapId"], r["matchId"]))
    with open(os.path.join(OUT_DIR, "matches.json"), "w") as f:
        json.dump(matches_out, f)
    print(f"wrote matches.json ({len(matches_out)} matches)")

    # ---- map config ----
    with open(os.path.join(OUT_DIR, "maps.json"), "w") as f:
        json.dump(MAP_CONFIG, f, indent=2)

    # ---- global manifest ----
    manifest = {
        "days": [d for d in DAYS if not full[full["day"] == d].empty],
        "totalRows": int(len(full)),
        "totalMatches": len(matches_out),
        "totalPlayers": int(full["user_id"].nunique()),
        "maps": sorted(full["map_id"].unique().tolist()),
        "eventDict": event_dict_global,
        "dataQualityNotes": [
            f"{len(mislabeled)} bot rows use non-standard event names "
            f"(e.g. 'Position'/'Loot' instead of 'BotPosition'); classification "
            f"uses user_id UUID-vs-numeric shape, not event name prefix.",
            "February 14 is a partial day (data collection was ongoing per README).",
        ],
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("wrote manifest.json")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
