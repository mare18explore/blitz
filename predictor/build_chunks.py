import os
import time
import requests
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai import errors

load_dotenv()

DRY_RUN = False  # leave this on to preview chunks, flip to False to actually embed and save
EMBED_MODEL = "gemini-embedding-001"
BATCH_SIZE = 100  # gemini lets us embed a bunch of texts in one call, way faster than one at a time
# set to a year to only rebuild that season, or None to rebuild everything
ONLY_SEASON = 2026


def get_team_names():
    # our csv only has team ids, so grab the real names from espn, e.g. "2" -> "Buffalo Bills"
    url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    data = requests.get(url, timeout=10).json()
    teams = data["sports"][0]["leagues"][0]["teams"]
    return {str(t["team"]["id"]): t["team"]["displayName"] for t in teams}


def split(sub):
    # turns a group of games into a record like 9-6, only adds ties when there actually were some
    w, l, t = int(sub["win"].sum()), int(sub["loss"].sum()), int(sub["tie"].sum())
    return f"{w}-{l}" + (f"-{t}" if t else "")


def build_team_season_chunks(df, names):
    rows = []
    # each game has a home and away team, so split every game into two rows
    # one from each team's point of view, makes the season totals way easier to add up
    for _, g in df.iterrows():
        for side, other in (("home", "away"), ("away", "home")):
            rows.append({
                "season": int(g["season"]),
                "team_id": str(g[f"{side}_id"]),
                "is_home": side == "home",
                "points_for": int(g[f"{side}_score"]),
                "points_against": int(g[f"{other}_score"]),
                "turnovers_committed": int(g[f"{side}_turnovers"]),
                "turnovers_forced": int(g[f"{other}_turnovers"]),
            })
    games = pd.DataFrame(rows)
    games["win"] = games["points_for"] > games["points_against"]
    games["tie"] = games["points_for"] == games["points_against"]
    games["loss"] = games["points_for"] < games["points_against"]

    chunks = []
    # one chunk per team per season, written as a plain sentence so the embedding captures the meaning
    for (season, team_id), t in games.groupby(["season", "team_id"]):
        name = names.get(team_id, f"Team {team_id}")
        n = len(t)
        home, away = t[t["is_home"]], t[~t["is_home"]]
        pf, pa = int(t["points_for"].sum()), int(t["points_against"].sum())
        tc, tf = int(t["turnovers_committed"].sum()), int(t["turnovers_forced"].sum())

        # games played is in there so a season that's still going doesn't look like a full one
        content = (
            f"{name}, {season} NFL regular season ({n} games played): {split(t)} record "
            f"(home {split(home)}, away {split(away)}). "
            f"Scored {pf} points ({pf / n:.1f} per game) and allowed {pa} "
            f"({pa / n:.1f} per game), a point differential of {pf - pa:+d}. "
            f"Turnovers: {tc} committed, {tf} forced, a turnover differential of {tf - tc:+d}."
        )
        chunks.append({
            "chunk_type": "team_season",
            "entity_id": team_id,
            "season": int(season),
            "content": content,
        })
    return chunks


def embed(client, texts, retries=3):
    # 768 dimensions keeps the vectors small enough for pgvector's fast index
    # RETRIEVAL_DOCUMENT tells gemini these are the stored texts, not the questions
    for attempt in range(retries):
        try:
            result = client.models.embed_content(
                model=EMBED_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    output_dimensionality=768,
                    task_type="RETRIEVAL_DOCUMENT",
                ),
            )
            return [e.values for e in result.embeddings]
        except errors.ClientError as e:
            # free tier only allows 100 embeddings a minute, so wait it out and try again
            if e.code == 429 and attempt < retries - 1:
                print("hit the rate limit, waiting 60 seconds...")
                time.sleep(60)
            else:
                raise


def to_pgvector(vec):
    # pgvector wants the numbers as a string like [0.1,0.2,...]
    return "[" + ",".join(str(x) for x in vec) + "]"


def main():
    df = pd.read_csv("games_2003_2026.csv")
    names = get_team_names()
    chunks = build_team_season_chunks(df, names)
    # no point re-embedding 25 years of data when only this season changed
    if ONLY_SEASON is not None:
        chunks = [c for c in chunks if c["season"] == ONLY_SEASON]
    print(f"built {len(chunks)} chunks")

    # preview a few chunks first so we don't waste api calls on bad data
    if DRY_RUN:
        for c in chunks[:3]:
            print("\n" + c["content"])
        print("\nDRY_RUN is on, nothing was embedded or saved.")
        return

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        vectors = embed(client, [c["content"] for c in batch])
        for c, vec in zip(batch, vectors):
            # if this team and season is already saved, update it instead of adding a duplicate
            # means we can safely rerun this script whenever the data changes
            cur.execute("""
                INSERT INTO nfl_chunks (chunk_type, entity_id, season, content, embedding)
                VALUES (%s, %s, %s, %s, %s::vector)
                ON CONFLICT (chunk_type, entity_id, season)
                DO UPDATE SET content = EXCLUDED.content,
                              embedding = EXCLUDED.embedding,
                              created_at = now();
            """, (c["chunk_type"], c["entity_id"], c["season"], c["content"], to_pgvector(vec)))
        conn.commit()  # commit after each batch so a crash halfway doesn't lose everything
        print(f"saved {min(i + BATCH_SIZE, len(chunks))}/{len(chunks)}")
        # only wait if there's another batch coming, free tier allows 100 embeddings a minute
        if i + BATCH_SIZE < len(chunks):
            time.sleep(61)

    cur.close()
    conn.close()
    print("done")


if __name__ == "__main__":
    main()