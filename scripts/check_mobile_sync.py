"""Run the real mobile SQLite/API tests against an isolated loopback demo server.

Requires server requirements, mobile npm dependencies, and Node 22+.
--server-root permits reviewing C's unmerged server without copying it into A.
Only disposable fictional users/data are created. No external API/model is called.
"""

import argparse
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server-root", type=Path, default=ROOT / "server")
    parser.add_argument("--serve", type=int)
    args = parser.parse_args()
    server_root = args.server_root.resolve()
    if not (server_root / "app" / "api.py").is_file():
        parser.error("The real server API must be present; merge C's reviewed server first.")
    if args.serve:
        sys.path.insert(0, str(server_root))
        import uvicorn
        from app.api import create_app

        uvicorn.run(create_app(dev_login=True), host="127.0.0.1", port=args.serve, log_level="warning")
        return 0
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="shifa-sync-") as directory:
        env = os.environ.copy()
        env.pop("GROQ_API_KEY", None)
        env["DATABASE_URL"] = "sqlite:///" + (Path(directory) / "server.db").as_posix()
        env["SHIFA_TEST_API_URL"] = f"http://127.0.0.1:{port}"
        process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                                    "--server-root", str(server_root), "--serve", str(port)], env=env)
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError("Disposable server exited before startup.")
                try:
                    with urlopen(env["SHIFA_TEST_API_URL"] + "/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.2)
            else:
                raise RuntimeError("Disposable server did not become ready.")
            return subprocess.call(["node", "node_modules/jest/bin/jest.js", "--runInBand", "--silent",
                                    "--testMatch", "**/__integration_tests__/mobileSync.test.ts"],
                                   cwd=ROOT / "mobile", env=env)
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
