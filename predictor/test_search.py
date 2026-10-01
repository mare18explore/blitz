import os
import psycopg2
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def search(question, k=5):
    # questions get RETRIEVAL_QUERY instead of RETRIEVAL_DOCUMENT, gemini embeds them a bit differently
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=[question],
        config=types.EmbedContentConfig(output_dimensionality=768, task_type="RETRIEVAL_QUERY"),
    )
    vec = "[" + ",".join(str(x) for x in result.embeddings[0].values) + "]"

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    # <=> is pgvector's cosine distance, smaller means more similar, so the closest chunks come first
    cur.execute(
        "SELECT content, embedding <=> %s::vector AS distance FROM nfl_chunks ORDER BY distance LIMIT %s",
        (vec, k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


for content, distance in search("How did the Buffalo Bills do in 2024?"):
    print(f"{distance:.3f}  {content}\n")