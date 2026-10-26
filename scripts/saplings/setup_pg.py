# Local Postgres for sandbox verification (mission S1).
#
#   python3 scripts/saplings/setup_pg.py
#
# Boots a throwaway PostgreSQL server on 127.0.0.1:5433 using the
# pip `pgserver` package's bundled binaries (no system Postgres
# needed). Idempotent: re-running only ensures the server is up and
# the `tomavine` database exists. Never point this at production —
# it is a local, trust-auth, disposable instance.
#
# Prints the DATABASE_URL to export:
#   postgresql://postgres@127.0.0.1:5433/tomavine
import os
import subprocess
import sys

try:
    from pgserver import postgres_server
except ImportError:
    sys.exit("pgserver is not installed — run: pip install pgserver")

BIN = str(postgres_server.POSTGRES_BIN_PATH)
HERE = os.path.dirname(os.path.abspath(__file__))
PGDATA = os.path.join(HERE, "pgdata")
PORT = "5433"
DB = "tomavine"
URL = f"postgresql://postgres@127.0.0.1:{PORT}/{DB}"


def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def pg_is_up():
    r = run([os.path.join(BIN, "pg_isready"), "-h", "127.0.0.1", "-p", PORT])
    return r.returncode == 0


def main():
    if not os.path.exists(os.path.join(PGDATA, "PG_VERSION")):
        print("initdb…")
        r = run([os.path.join(BIN, "initdb"), "-D", PGDATA, "-A", "trust", "-U", "postgres"])
        if r.returncode != 0:
            sys.exit("initdb failed:\n" + r.stderr)

    if not pg_is_up():
        print("starting postgres on 127.0.0.1:" + PORT + "…")
        r = run([
            os.path.join(BIN, "pg_ctl"), "-D", PGDATA,
            "-o", f"-p {PORT} -c listen_addresses=127.0.0.1",
            "-l", os.path.join(PGDATA, "tcp.log"),
            "start", "-w",
        ])
        if r.returncode != 0:
            sys.exit("pg_ctl start failed:\n" + r.stdout + r.stderr)
    else:
        print("postgres already up on :" + PORT)

    r = run([
        os.path.join(BIN, "psql"), "-h", "127.0.0.1", "-p", PORT, "-U", "postgres",
        "-tAc", f"SELECT 1 FROM pg_database WHERE datname = '{DB}'",
    ])
    if r.stdout.strip() != "1":
        print("creating database " + DB + "…")
        r = run([os.path.join(BIN, "createdb"), "-h", "127.0.0.1", "-p", PORT, "-U", "postgres", DB])
        if r.returncode != 0:
            sys.exit("createdb failed:\n" + r.stderr)
    else:
        print("database " + DB + " already exists")

    print("")
    print("Ready. Export before every prisma/next command:")
    print("  export DATABASE_URL=" + URL)


if __name__ == "__main__":
    main()
