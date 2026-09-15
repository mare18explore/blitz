from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, os
import numpy as np
import psycopg2 
import requests

app = Flask(__name__)
CORS(app)  # allows our React app to call this API without CORS errors

# postgres connection string from the environment, points at AWS RDS.
DATABASE_URL = os.environ.get("DATABASE_URL")

model = pickle.load(open("model.pkl", "rb"))
scaler = pickle.load(open("scaler.pkl", "rb"))
elo_ratings = pickle.load(open("elo_ratings.pkl", "rb"))
recent_scores = pickle.load(open("recent_scores.pkl", "rb"))
recent_allowed = pickle.load(open("recent_allowed.pkl", "rb"))
last_game_date = pickle.load(open("last_game_date.pkl", "rb"))
recent_results = pickle.load(open("recent_results.pkl", "rb"))
recent_turnovers = pickle.load(open("recent_turnovers.pkl", "rb"))

def get_db():
  # opens a fresh connection to postgres each time we need one
  return psycopg2.connect(DATABASE_URL)

def get_current_week():
    # ask ESPN what week it currently is, so we can calculate real rest days
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", timeout=10)
        data = r.json()
        return data.get("week", {}).get("number", 1)
    except Exception as e:
        print("failed to fetch current week, defaulting to normal rest:", e)
        return None
    
def get_elo(team_id):
  # try string first, then int — ESPN ids come back as strings from React
  # but might be stored as ints in the pkl file from pandas
  return elo_ratings.get(str(team_id)) or elo_ratings.get(int(team_id)) or 1500

TEAM_DIVISION = {
    "2": "AFC East", "15": "AFC East", "17": "AFC East", "20": "AFC East",
    "4": "AFC North", "5": "AFC North", "23": "AFC North", "33": "AFC North",
    "10": "AFC South", "11": "AFC South", "30": "AFC South", "34": "AFC South",
    "7": "AFC West", "12": "AFC West", "13": "AFC West", "24": "AFC West",
    "6": "NFC East", "19": "NFC East", "21": "NFC East", "28": "NFC East",
    "3": "NFC North", "8": "NFC North", "9": "NFC North", "16": "NFC North",
    "1": "NFC South", "18": "NFC South", "27": "NFC South", "29": "NFC South",
    "14": "NFC West", "22": "NFC West", "25": "NFC West", "26": "NFC West",
}

def get_division(team_id):
    return TEAM_DIVISION.get(str(team_id))

def get_weighted_recent(team_id, data_dict, recent_n=8, older_n=8, recent_weight=1.75, older_weight=1.0):
    all_games = data_dict.get(str(team_id)) or data_dict.get(team_id) or []
    total_needed = recent_n + older_n
    window = all_games[-total_needed:]

    if not window:
        return None

    recent_games = window[-recent_n:]
    older_games = window[:-recent_n] if len(window) > recent_n else []

    values = recent_games + older_games
    weights = [recent_weight] * len(recent_games) + [older_weight] * len(older_games)

    return float(np.average(values, weights=weights))

def get_recent_form(team_id):
    results = (recent_results.get(str(team_id)) or recent_results.get(team_id) or [])[-4:]
    return float(np.mean(results)) if results else 0.5

def get_avg_turnovers(team_id):
    recent = (recent_turnovers.get(str(team_id)) or recent_turnovers.get(team_id) or [])[-4:]
    return float(np.mean(recent)) if recent else 1.5

@app.route("/predict", methods=["POST"])
def predict():
  data = request.get_json()

  home_id = data.get("home_id")
  away_id = data.get("away_id")

  if not home_id or not away_id:
     return jsonify({ "error": "home_id and away_id are required" }), 400

  # build the same features we used during training
  home_elo = get_elo(home_id)
  away_elo = get_elo(away_id)

  home_off = get_weighted_recent(home_id, recent_scores) or 21
  away_off = get_weighted_recent(away_id, recent_scores) or 21
  home_def = get_weighted_recent(home_id, recent_allowed) or 21
  away_def = get_weighted_recent(away_id, recent_allowed) or 21

  current_week = get_current_week()

  if current_week:
    home_rest = current_week - last_game_date.get(str(home_id), current_week - 1)
    away_rest = current_week - last_game_date.get(str(away_id), current_week - 1)
  else:
    home_rest = 1
    away_rest = 1

  home_form = get_recent_form(home_id)
  away_form = get_recent_form(away_id)

  if get_division(home_id) == get_division(away_id) and get_division(home_id) is not None:
    same_division = 1
  else:
    same_division = 0

  home_turnover_avg = get_avg_turnovers(home_id)
  away_turnover_avg = get_avg_turnovers(away_id)
  turnover_diff = away_turnover_avg - home_turnover_avg

  features = np.array([[
    home_elo,
    away_elo,
    home_elo - away_elo,
    home_off,
    away_off,
    home_def,
    away_def,
    home_rest,
    away_rest,
    1,
    home_form,
    away_form,
    same_division,
    turnover_diff
  ]])

  # scale the features the same way they were scaled during training
  features_scaled = scaler.transform(features)

  # predict_proba returns [prob_loss, prob_win] — we want the second one
  home_win_prob = model.predict_proba(features_scaled)[0][1]
  away_win_prob = 1 - home_win_prob

  # round to match what we send back to the frontend
  home_prob = round(float(home_win_prob) * 100, 1)
  away_prob = round(float(away_win_prob) * 100, 1)
  predicted_winner = home_id if home_prob > away_prob else away_id

  # save this prediction to postgres so we can show history later
  # wrapped in try/except so a db hiccup doesnt break the actual prediction
  try:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
      """
      insert into predictions
        (home_team_id, away_team_id, home_win_prob, away_win_prob, predicted_winner)
      values (%s, %s, %s, %s, %s)
      """,
      (home_id, away_id, home_prob, away_prob, predicted_winner)
    )
    conn.commit()
    cur.close()
    conn.close()
  except Exception as e:
    print("failed to save prediction:", e)


  return jsonify({
    "home_id": home_id,
    "away_id": away_id,
    "home_win_prob": home_prob,
    "away_win_prob": away_prob,
  })

@app.route("/scoreboard", methods=["GET"])
def get_scoreboard():
  # same server-side proxy reason as /teams, safari gets 403'd going direct
  url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  try:
    r = requests.get(url, timeout=10)
    data = r.json()
  except Exception as e:
    print("failed to fetch scoreboard:", e)
    return jsonify({"error": "could not fetch scoreboard"}), 500

  games = []

  for event in data.get("events", []):
    comp = (event.get("competitions") or [{}])[0]
    status = comp.get("status", {}).get("type", {})

    home = None
    away = None
    for side in comp.get("competitors", []):
      info = side.get("team", {})
      records = side.get("records") or []
      parsed = {
        "id": str(info.get("id")),
        "name": info.get("shortDisplayName"),
        "logo": info.get("logo"),
        "score": side.get("score"),
        # first entry is the overall record, the rest are home/away splits
        "record": records[0].get("summary") if records else None,
      }
      if side.get("homeAway") == "home":
        home = parsed
      else:
        away = parsed

    games.append({
      "id": event.get("id"),
      "date": event.get("date"),
      # pre, in or post, easier to switch on in React than the full status text
      "state": status.get("state"),
      "detail": status.get("shortDetail"),
      "home": home,
      "away": away,
    })

  return jsonify({"week": data.get("week", {}).get("number"), "games": games})
@app.route("/game/<game_id>", methods=["GET"])
def get_game(game_id):
  # espn's summary endpoint has the full box score for a single game
  url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={game_id}"
  try:
    r = requests.get(url, timeout=10)
    data = r.json()
  except Exception as e:
    print("failed to fetch game summary:", e)
    return jsonify({"error": "could not fetch game"}), 500

  header = data.get("header", {})
  comp = (header.get("competitions") or [{}])[0]
  status = comp.get("status", {}).get("type", {})

  # the box score lists both teams with their stat totals
  teams = []
  for entry in data.get("boxscore", {}).get("teams", []):
    info = entry.get("team", {})
    # espn gives stats as a flat list of name/value pairs, easier to use as a dict
    stats = {s.get("name"): s.get("displayValue") for s in entry.get("statistics", [])}
    teams.append({
      "id": str(info.get("id")),
      "name": info.get("displayName"),
      "logo": info.get("logo"),
      "stats": stats,
    })

  # scores live on the header competitors, not in the boxscore
  scores = {}
  for side in comp.get("competitors", []):
    scores[str(side.get("id"))] = {
      "score": side.get("score"),
      "homeAway": side.get("homeAway"),
      "record": (side.get("record") or [{}])[0].get("summary"),
    }

  return jsonify({
    "id": game_id,
    "date": comp.get("date"),
    "state": status.get("state"),
    "detail": status.get("shortDetail"),
    "teams": teams,
    "scores": scores,
  })

@app.route("/teams", methods=["GET"])
def get_teams():
  # fetch teams from espn server-side so safari's browser headers dont get 403'd
  try:
    r = requests.get("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=40")
    return jsonify(r.json())
  except Exception as e:
    print("failed to fetch teams:", e)
    return jsonify({"error": "could not fetch teams"}), 500
  
@app.route("/predictions", methods=["GET"])
def get_predictions():
    # pull the 10 most recent predictions, newest first
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        select home_team_id, away_team_id, home_win_prob, away_win_prob,
               predicted_winner, created_at
        from predictions
        order by created_at desc
        limit 10
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # turn each row tuple into an object the frontend can use
    predictions = [
        {
            "home_id": r[0],
            "away_id": r[1],
            "home_win_prob": float(r[2]),
            "away_win_prob": float(r[3]),
            "predicted_winner": r[4],
            "created_at": r[5].isoformat(),
        }
        for r in rows
    ]
    return jsonify(predictions)


if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5001))
  app.run(debug=False, host="0.0.0.0", port=port)
