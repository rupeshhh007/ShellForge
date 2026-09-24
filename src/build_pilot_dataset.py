import json
from pathlib import Path
from collections import Counter

CURATED = Path("data/sample_dataset.jsonl")
NL2BASH = Path("data/nl2bash_sample.jsonl")
OUTPUT = Path("data/pilot_dataset.jsonl")


def infer_category(command):
    cmd = command.lower()

    if any(x in cmd for x in ["ps ", "top ", "kill ", "pgrep", "pkill"]):
        return "process_management"

    if any(x in cmd for x in ["grep ", "sed ", "awk ", "wc ", "cut ", "sort "]):
        return "text_processing"

    if any(x in cmd for x in ["chmod ", "chown ", "chgrp "]):
        return "permissions"

    if any(x in cmd for x in ["ss ", "netstat", "ping ", "curl ", "wget ", "lsof -i"]):
        return "networking"

    if any(x in cmd for x in ["tar ", "zip ", "unzip ", "gzip ", "gunzip "]):
        return "compression"

    if any(x in cmd for x in ["df ", "du ", "free ", "uptime"]):
        return "system_monitoring"

    if any(x in cmd for x in ["find ", "locate "]):
        return "file_search"

    if any(x in cmd for x in ["ls ", "cp ", "mv ", "rm ", "mkdir ", "touch "]):
        return "file_operations"

    return "other"


records = []
seen = set()

for file_path in [CURATED, NL2BASH]:

    with open(file_path) as f:
        for line in f:
            if not line.strip():
                continue

            item = json.loads(line)

            key = (
                item["instruction"].strip().lower(),
                item["command"].strip()
            )

            if key in seen:
                continue

            seen.add(key)

            # Only replace category if imported sample is unclassified
            if item.get("category") in [None, "", "unclassified"]:
                item["category"] = infer_category(item["command"])

            records.append(item)


with open(OUTPUT, "w") as f:
    for item in records:
        f.write(json.dumps(item) + "\n")


print("Total pilot records:", len(records))

risk_counts = Counter(x["risk"] for x in records)
category_counts = Counter(x["category"] for x in records)

print("\nRisk distribution:")
for key, value in risk_counts.items():
    print(f"{key}: {value}")

print("\nCategory distribution:")
for key, value in category_counts.most_common():
    print(f"{key}: {value}")

print("\nSaved to:", OUTPUT)