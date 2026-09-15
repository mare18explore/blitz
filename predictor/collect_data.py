import requests
import pandas as pd
import time

# ESPN scoreboard endpoint — returns every game for a given season and week
BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"


def fetch_games(season, week):
  # hit the ESPN API for one week of games and return the raw events list
  try:
    res = requests.get(BASE_URL, params={
      "dates": season,
      "seasontype": 2,  # 2 = regular season, 3 = playoffs
      "week": week
    }, timeout=10)
    return res.json().get("events", [])
  except Exception as e:
    print(f"failed {season} week {week}: {e}")
    return []

def fetch_turnovers(event_id):
    # hit ESPN's summary endpoint for one game and pull turnover counts for both teams
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event_id}"
    try:
        res = requests.get(url, timeout=10)
        data = res.json()
        teams = data.get("boxscore", {}).get("teams", [])

        turnovers = {}
        for entry in teams:
            team_id = str(entry.get("team", {}).get("id"))
            for stat in entry.get("statistics", []):
                if stat.get("name") == "turnovers":
                    turnovers[team_id] = int(stat.get("displayValue", 0))
                    break

        return turnovers
    except Exception as e:
        print(f"failed to fetch turnovers for event {event_id}: {e}")
        return {}

def parse_game(event):
  # pull the two teams out of the competitors array
  competition = event.get("competitions", [{}])[0]
  competitors = competition.get("competitors", [])

  if len(competitors) != 2:
    return None

  # find home and away team by checking the homeAway field on each competitor
  home_team = None
  away_team = None
  for c in competitors:
    if c["homeAway"] == "home":
      home_team = c
    elif c["homeAway"] == "away":
      away_team = c

  if not home_team or not away_team:
    return None

  # skip games that havent been played yet
  completed = competition.get("status", {}).get("type", {}).get("completed")
  if not completed:
    return None

  home_score = int(home_team.get("score", 0))
  away_score = int(away_team.get("score", 0))

  # home_win is our target variable, 1 if home team won, 0 if they lost
  home_win = 1 if home_score > away_score else 0

  # fetch turnover counts for this specific game
  event_id = event.get("id")
  turnovers = fetch_turnovers(event_id)
  home_turnovers = turnovers.get(str(home_team["team"]["id"]), 0)
  away_turnovers = turnovers.get(str(away_team["team"]["id"]), 0)

  return {
    "season": event.get("season", {}).get("year"),
    "week": event.get("week", {}).get("number"),
    "home_id": home_team["team"]["id"],
    "away_id": away_team["team"]["id"],
    "home_score": home_score,
    "away_score": away_score,
    "home_turnovers": home_turnovers,
    "away_turnovers": away_turnovers,
    "home_win": home_win
  }


def collect_all():
  all_games = []

  # loop through every season and every week and collect all the games
  for season in range(2002, 2027):
    print(f"fetching {season}...")
    for week in range(1, 19):
      events = fetch_games(season, week)
      for event in events:
        game = parse_game(event)
        if game:
          all_games.append(game)
      time.sleep(0.2)  # small pause so we dont get rate limited by ESPN

  df = pd.DataFrame(all_games)
  df.to_csv("games_2003_2026.csv", index=False)
  print(f"done — {len(df)} games saved to games_2015_2026.csv")


collect_all()