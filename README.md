## Run with Docker

Build image:

```bash
docker build -t slm-backend .
```

Run container (provide Groq API key as env):

```bash
docker run --rm -p 8000:8000 -e GROQ_API_KEY=your_groq_api_key slm-backend
```

If `GROQ_API_KEY` is not provided, the app still runs and falls back to local model output.
# SLM
SLM for healthcare domain
