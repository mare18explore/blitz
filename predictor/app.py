from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, os
import numpy as np
import psycopg2 

app = Flask(__name__)
CORS(app)  # allows our React app to call this API without CORS errors

# grab the neon connection string from the environment
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
  # opens a fresh connection to postgres each time we need one
  return psycopg2.connect(DATABASE_URL)

# load the model and team stats we saved during training
model = pickle.load(open("model.pkl", "rb"))
elo_ratings = pickle.load(open("elo_ratings.pkl", "rb"))
recent_scores = pickle.load(open("recent_scores.pkl", "rb"))
recent_allowed = pickle.load(open("recent_allowed.pkl", "rb"))

def get_elo(team_id):
  # try string first, then int — ESPN ids come back as strings from React
  # but might be stored as ints in the pkl file from pandas
  return elo_ratings.get(str(team_id)) or elo_ratings.get(int(team_id)) or 1500

def get_recent_avg(team_id, data_dict):
  # try string first, then int — same reason as get_elo
  recent = data_dict.get(str(team_id)) or data_dict.get(int(team_id)) or []
  recent = recent[-4:]
  return float(np.mean(recent)) if recent else 21.0

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
  home_off = get_recent_avg(home_id, recent_scores)
  away_off = get_recent_avg(away_id, recent_scores)
  home_def = get_recent_avg(home_id, recent_allowed)
  away_def = get_recent_avg(away_id, recent_allowed)

  features = np.array([[
    home_elo,
    away_elo,
    # elo_diff
    home_elo - away_elo,
    home_off,
    away_off,
    home_def,
    away_def,
    1,  # home_rest — assume normal rest
    1,  # away_rest — assume normal rest
    1   # home_field — always 1 for home team
  ]])

  # predict_proba returns [prob_loss, prob_win] — we want the second one
  home_win_prob = model.predict_proba(features)[0][1]
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
