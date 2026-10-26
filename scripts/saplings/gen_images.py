# Generates the 80 sapling-catalog photos as original AI artwork
# (mission S1), following the PC3-proven throughput settings:
#
#   - EXACTLY 2 parallel workers (more triggers 429 error storms)
#   - a global flock start-gate staggering the workers ~12s apart
#   - ~20s pause between images per worker (~2.7 images/minute)
#   - on failure (incl. HTTP 429): back off 30s and retry, up to 5
#     retries per image
#
#   python3 gen_images.py            # driver: spawns the 2 workers
#   python3 gen_images.py --worker 0 --workers 2   # single worker
#
# Renders 1024x1024 PNGs into ./raw/<slug>.png,
# resume-safe: valid existing PNGs are skipped, partial files from
# failed attempts are removed before retrying.
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
PROMPTS = os.path.join(HERE, "out", "images.json")
GATE = os.path.join(HERE, ".gen_gate")
WORKERS = 2
STAGGER_S = 12      # start-gate stagger between the two workers
PAUSE_S = 20        # pause between images, per worker
BACKOFF_S = 30      # first retry backoff (grows by 30s per attempt)
MAX_RETRIES = 5     # per image
CMD_TIMEOUT_S = 240
MIN_PNG_BYTES = 10000


def valid_png(path):
    try:
        if os.path.getsize(path) < MIN_PNG_BYTES:
            return False
        from PIL import Image  # noqa: PLC0415
        with Image.open(path) as im:
            im.verify()
        return True
    except Exception:  # noqa: BLE001
        return False


def gate_stagger():
    """First starter goes immediately; the second waits ~STAGGER_S.

    The first worker holds the gate lock for 3s so a simultaneous
    second worker reliably misses the non-blocking try, blocks on
    the lock, and then knows to stagger itself.
    """
    import fcntl
    lock = open(GATE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        first = True
        time.sleep(3)  # hold the gate so the other worker blocks on it
    except OSError:
        fcntl.flock(lock, fcntl.LOCK_EX)  # blocks until first worker releases
        first = False
    fcntl.flock(lock, fcntl.LOCK_UN)
    lock.close()
    if not first:
        time.sleep(STAGGER_S)
    return first


def run_image(slug, prompt, log):
    out = os.path.join(RAW, slug + ".png")
    for attempt in range(1, MAX_RETRIES + 2):
        if os.path.exists(out):
            os.remove(out)  # partial file from a failed attempt
        try:
            r = subprocess.run(
                ["z-ai", "image", "-p", prompt, "-o", out, "-s", "1024x1024"],
                capture_output=True, text=True, timeout=CMD_TIMEOUT_S,
            )
            if r.returncode == 0 and valid_png(out):
                log(f"OK   {slug} (attempt {attempt})")
                return True
            err = (r.stderr or r.stdout or "").strip().replace("\n", " ")[:160]
            is429 = "429" in err or "Too Many Requests" in err
            log(f"FAIL {slug} attempt {attempt}: {err}{' [429]' if is429 else ''}")
        except subprocess.TimeoutExpired:
            log(f"FAIL {slug} attempt {attempt}: timeout after {CMD_TIMEOUT_S}s")
        if attempt <= MAX_RETRIES:
            wait = BACKOFF_S * attempt
            log(f"     backing off {wait}s before retry…")
            time.sleep(wait)
    log(f"GIVEUP {slug}")
    return False


def worker(idx, workers):
    os.makedirs(RAW, exist_ok=True)
    log_path = os.path.join(RAW, f"gen_worker{idx}.log")

    def log(msg):
        line = f"[w{idx} {time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    with open(PROMPTS, encoding="utf-8") as f:
        prompts = json.load(f)
    slugs = sorted(prompts)[idx::workers]

    first = gate_stagger()
    log(f"start ({'first' if first else 'staggered +12s'}), {len(slugs)} images queued")

    done = 0
    failed = []
    for n, slug in enumerate(slugs, start=1):
        out = os.path.join(RAW, slug + ".png")
        if valid_png(out):
            log(f"skip {slug} (already rendered) [{n}/{len(slugs)}]")
            continue
        if run_image(slug, prompts[slug], log):
            done += 1
        else:
            failed.append(slug)
        log(f"progress {n}/{len(slugs)} (new this run: {done})")
        if n < len(slugs):
            time.sleep(PAUSE_S)

    log(f"worker {idx} finished: {done} generated, {len(failed)} failed")
    return failed


def main():
    if "--worker" in sys.argv:
        idx = int(sys.argv[sys.argv.index("--worker") + 1])
        workers = int(sys.argv[sys.argv.index("--workers") + 1])
        sys.exit(1 if worker(idx, workers) else 0)

    # Driver: exactly 2 workers in parallel. Each worker gets its own
    # session so the driver can tear the whole tree down on SIGTERM
    # (chunked runs: `timeout 540 python3 gen_images.py` then re-run —
    # already-rendered images are skipped, so chunks compose).
    import signal

    procs = [subprocess.Popen(
        [sys.executable, os.path.abspath(__file__), "--worker", str(i), "--workers", str(WORKERS)],
        start_new_session=True,
    ) for i in range(WORKERS)]

    def teardown(signum, frame):  # noqa: ARG001
        for p in procs:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:  # noqa: BLE001
                pass
        sys.exit(130)

    signal.signal(signal.SIGTERM, teardown)
    signal.signal(signal.SIGINT, teardown)
    codes = [p.wait() for p in procs]

    with open(PROMPTS, encoding="utf-8") as f:
        prompts = json.load(f)
    missing = [s for s in sorted(prompts) if not valid_png(os.path.join(RAW, s + ".png"))]
    print("\n────────────────────────────────")
    print(f"workers exited: {codes}")
    print(f"renders present: {len(prompts) - len(missing)}/{len(prompts)}")
    if missing:
        print("MISSING: " + ", ".join(missing))
        print("re-run this script to retry only the missing ones.")
        sys.exit(1)
    print("ALL 80 RENDERS DONE — next: python3 optimize_images.py")


if __name__ == "__main__":
    main()
