"""Production entry point with a validated platform-supplied port."""

import os

import uvicorn


def main():
    port = int(os.getenv("PORT", "8010"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be in 1–65535")
    uvicorn.run(
        "services.api.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        proxy_headers=False,
        limit_concurrency=40,
        timeout_keep_alive=5,
        access_log=False,
    )


if __name__ == "__main__":
    main()
