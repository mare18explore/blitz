import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pickle

# load the games we collected
df = pd.read_csv("games.csv")

# sort by season and week so we process games in chronological order
# this is important because we build each team's stats as we go
df = df.sort_values(["season", "week"]).reset_index(drop=True)

# starting Elo for every team — 1500 is the standard starting point
# teams above 1500 are above average, below 1500 are below average
ELO_START = 1500
K = 20  # how much Elo changes after each game — higher K means faster changes

elo_ratings = {}  # stores current Elo for each team as we go through games

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

def get_recent(team_id, data_dict, n=4):
  # return the last n values for this team, or empty list if not enough games yet
  return data_dict.get(team_id, [])[-n:]

def update_recent(team_id, scored, allowed, week):
  if team_id not in recent_scores:
    recent_scores[team_id] = []
    recent_allowed[team_id] = []
  recent_scores[team_id].append(scored)
  recent_allowed[team_id].append(allowed)
  last_game_date[team_id] = week

# build the feature rows — one row per game
rows = []

for _, game in df.iterrows():
  home_id = game["home_id"]
  away_id = game["away_id"]
  week = game["week"]
  season = game["season"]

  # get current Elo for both teams before this game
  home_elo = get_elo(home_id)
  away_elo = get_elo(away_id)

  # offensive rating — average points scored in last 4 games
  home_off = np.mean(get_recent(home_id, recent_scores)) if get_recent(home_id, recent_scores) else 21
  away_off = np.mean(get_recent(away_id, recent_scores)) if get_recent(away_id, recent_scores) else 21

  # defensive rating — average points allowed in last 4 games (lower is better)
  home_def = np.mean(get_recent(home_id, recent_allowed)) if get_recent(home_id, recent_allowed) else 21
  away_def = np.mean(get_recent(away_id, recent_allowed)) if get_recent(away_id, recent_allowed) else 21

  # rest days — how many weeks since last game (1 = normal, 2 = bye week)
  home_rest = week - last_game_date.get(home_id, week - 1)
  away_rest = week - last_game_date.get(away_id, week - 1)

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
    "home_win": game["home_win"]  # target variable
  })

  # now update everything with what actually happened in this game
  home_score = game["home_score"]
  away_score = game["away_score"]

  if home_score > away_score:
    update_elo(home_id, away_id)
  else:
    update_elo(away_id, home_id)

  update_recent(home_id, home_score, away_score, week)
  update_recent(away_id, away_score, home_score, week)

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

# train the logistic regression model
model = LogisticRegression()
model.fit(X_train, y_train)

# check accuracy on the test set
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
print(f"model accuracy: {accuracy:.1%}")

# save the model and team stats to disk so the Flask API can load them
pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(elo_ratings, open("elo_ratings.pkl", "wb"))
pickle.dump(recent_scores, open("recent_scores.pkl", "wb"))
pickle.dump(recent_allowed, open("recent_allowed.pkl", "wb"))

print("model saved to model.pkl")
print("elo ratings saved to elo_ratings.pkl")