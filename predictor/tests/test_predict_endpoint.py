import app
from app import app as flask_app

class FakeModel:
  # stand-in for sklearn model
  def predict_proba(self, features):
    # always return a fixed 70% home win probability, so our test is predictable
    return [[0.3, 0.7]]

def test_predict_missing_home_id_returns_400():
  client = flask_app.test_client()
  response = client.post("/predict", json={"away_id": "5"})
  assert response.status_code == 400

def test_predict_missing_away_id_returns_400():
  client = flask_app.test_client()
  response = client.post("/predict", json={"home_id": "5"})
  assert response.status_code == 400

def test_predict_returns_valid_probabilities():
  # fake out the model and data so we don't need real files or a database
  app.model = FakeModel()
  app.elo_ratings = {"5": 1500, "10": 1500}
  app.recent_scores = {}
  app.recent_allowed = {}

  client = flask_app.test_client()
  response = client.post("/predict", json={"home_id": "5", "away_id": "10"})

  assert response.status_code == 200
  data = response.get_json()
  assert data["home_win_prob"] == 70.0
  assert data["away_win_prob"] == 30.0