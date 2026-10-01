import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

cur.execute("""
CREATE TABLE IF NOT EXISTS nfl_chunks (
    id SERIAL PRIMARY KEY,
    chunk_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    season INT,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (chunk_type, entity_id, season)
);
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS nfl_chunks_embedding_idx
ON nfl_chunks USING hnsw (embedding vector_cosine_ops);
""")

conn.commit()
cur.close()
conn.close()
print("pgvector enabled and nfl_chunks table ready")