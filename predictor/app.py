from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np

app = Flask(__name__)
CORS(app)  # allows our React app to call this API without CORS errors

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

  return jsonify({
    "home_id": home_id,
    "away_id": away_id,
    "home_win_prob": round(float(home_win_prob) * 100, 1),
    "away_win_prob": round(float(away_win_prob) * 100, 1),
})

if __name__ == "__main__":
  app.run(debug=True, port=5001)