import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import pickle

# load the games we collected
df = pd.read_csv("games_2003_2026.csv")

# sort by season and week so we process games in chronological order
# this is important because we build each team's stats as we go
df = df.sort_values(["season", "week"]).reset_index(drop=True)

# starting Elo for every team — 1500 is the standard starting point
# teams above 1500 are above average, below 1500 are below average
ELO_START = 1500
K = 20  # how much Elo changes after each game — higher K means faster changes

elo_ratings = {}  # stores current Elo for each team as we go through games

# team_id -> division, based on ESPN's team IDs (same ones used in your Standings.jsx)
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

def get_elo(team_id):
  # if we havent seen this team yet give them the starting Elo
  if team_id not in elo_ratings:
    elo_ratings[team_id] = ELO_START
  return elo_ratings[team_id]

def update_elo(winner_id, loser_id):
  winner_elo = get_elo(winner_id)
  loser_elo = get_elo(loser_id)

  # expected win probability based on current ratings
  expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))

  # update ratings — winner goes up, loser goes down
  elo_ratings[winner_id] = winner_elo + K * (1 - expected_winner)
  elo_ratings[loser_id] = loser_elo + K * (0 - (1 - expected_winner))

# recent form — store last 4 scores per team so we can calc offensive/defensive rating
recent_scores = {}   # points scored per game
recent_allowed = {}  # points allowed per game
last_game_date = {}  # track week of last game for rest days

# stores each team's final offense/defense rating at the end of each season they played
season_end_off = {}
season_end_def = {}
team_last_season = {}  # tracks which season we last saw this team in

def check_season_rollover(team_id, season):
    # if this team's last recorded season is different from the current one,
    # save their final rating from that prior season as their new starting point
    last_season = team_last_season.get(team_id)
    if last_season is not None and last_season != season:
        prior_off = get_weighted_recent(team_id, recent_scores)
        prior_def = get_weighted_recent(team_id, recent_allowed)
        if prior_off is not None:
            season_end_off[team_id] = prior_off
        if prior_def is not None:
            season_end_def[team_id] = prior_def
    team_last_season[team_id] = season

def get_recent(team_id, data_dict, n=4):
  # return the last n values for this team, or empty list if not enough games yet
  return data_dict.get(team_id, [])[-n:]

def get_weighted_recent(team_id, data_dict, recent_n=8, older_n=8, recent_weight=1.75, older_weight=1.0):
    # pull a longer window: recent_n most recent games, plus older_n games before that
    all_games = data_dict.get(team_id, [])
    total_needed = recent_n + older_n
    window = all_games[-total_needed:]

    if not window:
        return None

    # split into the older chunk and the more recent chunk
    recent_games = window[-recent_n:]
    older_games = window[:-recent_n] if len(window) > recent_n else []

    values = recent_games + older_games
    weights = [recent_weight] * len(recent_games) + [older_weight] * len(older_games)

    return float(np.average(values, weights=weights))

def update_recent(team_id, scored, allowed, week):
  if team_id not in recent_scores:
    recent_scores[team_id] = []
    recent_allowed[team_id] = []
  recent_scores[team_id].append(scored)
  recent_allowed[team_id].append(allowed)
  last_game_date[team_id] = week

# 1 for win, 0 for loss, per team, most recent games
recent_results = {} 

def update_results(team_id, won):
    if team_id not in recent_results:
        recent_results[team_id] = []
    recent_results[team_id].append(1 if won else 0)

def get_recent_form(team_id):
    # win rate over the last 4 games, defaults to 0.5 (even) if no history yet
    results = recent_results.get(team_id, [])[-4:]
    return float(np.mean(results)) if results else 0.5

# turnovers committed per team, most recent games
recent_turnovers = {}

def update_turnovers(team_id, turnovers):
  if team_id not in recent_turnovers:
    recent_turnovers[team_id] = []
  recent_turnovers[team_id].append(turnovers)

def get_avg_turnovers(team_id):
  recent = recent_turnovers.get(team_id, [])[-4:]
  return float(np.mean(recent)) if recent else 1.5

# build the feature rows — one row per game
rows = []

for _, game in df.iterrows():
  home_id = game["home_id"]
  away_id = game["away_id"]
  week = game["week"]
  season = game["season"]

  # check if either team just entered a new season, carry over their rating if so
  check_season_rollover(home_id, season)
  check_season_rollover(away_id, season)

  # get current Elo for both teams before this game
  home_elo = get_elo(home_id)
  away_elo = get_elo(away_id)

  # offensive rating, falls back to last season's rating, then 21 if truly no history
  home_off = get_weighted_recent(home_id, recent_scores) or season_end_off.get(home_id, 21)
  away_off = get_weighted_recent(away_id, recent_scores) or season_end_off.get(away_id, 21)

  # defensive rating, same fallback logic
  home_def = get_weighted_recent(home_id, recent_allowed) or season_end_def.get(home_id, 21)
  away_def = get_weighted_recent(away_id, recent_allowed) or season_end_def.get(away_id, 21)

  # rest days how many weeks since last game (1 = normal, 2 = bye week)
  home_rest = week - last_game_date.get(home_id, week - 1)
  away_rest = week - last_game_date.get(away_id, week - 1)

  home_form = get_recent_form(home_id)
  away_form = get_recent_form(away_id)
  # cehck for divisional matchup
  if get_division(home_id) == get_division(away_id) and get_division(home_id) is not None:
     same_division = 1
  else:
     same_division = 0

  # positive means home team turns it over less (good for home)
  home_turnover_avg = get_avg_turnovers(home_id)
  away_turnover_avg = get_avg_turnovers(away_id)
  turnover_diff = away_turnover_avg - home_turnover_avg 

  rows.append({
    "home_elo": home_elo,
    "away_elo": away_elo,
    "elo_diff": home_elo - away_elo,  # positive means home team is stronger
    "home_off": home_off,
    "away_off": away_off,
    "home_def": home_def,
    "away_def": away_def,
    "home_rest": home_rest,
    "away_rest": away_rest,
    "home_field": 1,       # home team always gets this
    "home_form": home_form,
    "away_form": away_form,
    "same_division": same_division,
    "turnover_diff": turnover_diff,
    "home_win": game["home_win"]  # target variable
  })

  # now update everything with what actually happened in this game
  home_score = game["home_score"]
  away_score = game["away_score"]

  update_turnovers(home_id, game["home_turnovers"])
  update_turnovers(away_id, game["away_turnovers"])

  if home_score > away_score:
    update_elo(home_id, away_id)
  else:
    update_elo(away_id, home_id)

  # basically how much the home team scored and how much they let other tram score and wghat happend in recent weeks etc
  update_recent(home_id, home_score, away_score, week)
  update_recent(away_id, away_score, home_score, week)
  update_results(home_id, home_score > away_score)
  update_results(away_id, away_score > home_score)

# turn our list of rows into a dataframe
features_df = pd.DataFrame(rows)

# separate features (X) from the target variable (y)
# X is everything the model uses to make a prediction
# y is what we're trying to predict — did the home team win
X = features_df.drop(columns=["home_win"])
y = features_df["home_win"]

# split into training and test sets — 80% train, 20% test
# test_size=0.2 means 20% of games are held back to evaluate the accuracy
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# scale features so they're comparable to each other
# elo values are around 1500, while rest days are small numbers like 1 or 2
# without scaling, the model can't fairly judge which features actually matter
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# train the logistic regression model
model = LogisticRegression(class_weight='balanced', max_iter=1000)
model.fit(X_train_scaled, y_train)

# check accuracy on the test set
predictions = model.predict(X_test_scaled)
accuracy = accuracy_score(y_test, predictions)


# baseline: what if we just always picked the home team to win?
baseline_accuracy = y_test.mean() if y_test.mean() > 0.5 else 1 - y_test.mean()
print(f"baseline accuracy (always pick home team): {baseline_accuracy:.1%}")
print(f"model accuracy: {accuracy:.1%}")
print(f"improvement over baseline: {(accuracy - baseline_accuracy) * 100:.1f} percentage points")

print("\nDetailed performance:")
print(classification_report(y_test, predictions, target_names=["away win", "home win"]))

print("Confusion matrix:")
print(confusion_matrix(y_test, predictions))

# feature importance: which engineered features matter most to the model's decisions
print("\nFeature importance (by coefficient magnitude):")
feature_names = X.columns
coefficients = model.coef_[0]

# positive coefficient pushes toward predicting a home win, negative pushes toward an away win
importance = pd.DataFrame({
    "feature": feature_names,
    "coefficient": coefficients
}).sort_values(by="coefficient", key=abs, ascending=False)

print(importance.to_string(index=False))

# save the model and team stats to disk so the Flask API can load them
pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(scaler, open("scaler.pkl", "wb"))
pickle.dump(elo_ratings, open("elo_ratings.pkl", "wb"))
pickle.dump(recent_scores, open("recent_scores.pkl", "wb"))
pickle.dump(recent_allowed, open("recent_allowed.pkl", "wb"))
pickle.dump(last_game_date, open("last_game_date.pkl", "wb"))
pickle.dump(recent_results, open("recent_results.pkl", "wb"))
pickle.dump(recent_turnovers, open("recent_turnovers.pkl", "wb"))

print("model saved to model.pkl")
print("elo ratings saved to elo_ratings.pkl")