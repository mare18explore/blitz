import pandas as pd
from collect_data import fetch_games, parse_game

SEASON = 2026
CSV_FILE = "games_2003_2026.csv"

# grab every completed game so far this season, parse_game already skips games that haven't been played
new_games = []
for week in range(1, 19):
    for event in fetch_games(SEASON, week):
        game = parse_game(event)
        if game:
            new_games.append(game)

# swap out the old rows for this season and keep everything else the same
df = pd.read_csv(CSV_FILE)
df = df[df["season"] != SEASON]
df = pd.concat([df, pd.DataFrame(new_games)], ignore_index=True)
df.to_csv(CSV_FILE, index=False)

print(f"updated {SEASON}: {len(new_games)} completed games, {len(df)} games total")