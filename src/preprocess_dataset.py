import json
import random
from pathlib import Path

INPUT_FILE = Path("data/pilot_dataset.jsonl")
OUTPUT_DIR = Path("data/processed")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

records = []
seen = set()

# 1. Load + validate + remove duplicates
with open(INPUT_FILE, "r") as f:
    for line_number, line in enumerate(f, 1):
        line = line.strip()

        if not line:
            continue

        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            print(f"Skipping invalid JSON at line {line_number}")
            continue

        required = [
            "instruction",
            "command",
            "category",
            "risk",
            "explanation",
            "safe_alternative"
        ]

        if not all(key in item for key in required):
            print(f"Skipping incomplete record at line {line_number}")
            continue

        # Normalize text
        item["instruction"] = item["instruction"].strip()
        item["command"] = item["command"].strip()
        item["category"] = item["category"].strip().lower()
        item["risk"] = item["risk"].strip().upper()
        item["explanation"] = item["explanation"].strip()

        # Basic risk validation
        if item["risk"] not in {"SAFE", "CAUTION", "DANGEROUS"}:
            print(f"Skipping invalid risk at line {line_number}")
            continue

        # Duplicate based on instruction + command
        key = (
            item["instruction"].lower(),
            item["command"]
        )

        if key in seen:
            continue

        seen.add(key)
        records.append(item)


print("Valid unique records:", len(records))


# 2. Shuffle
random.seed(42)
random.shuffle(records)


# 3. Split 80 / 10 / 10
n = len(records)

train_end = int(n * 0.8)
val_end = train_end + int(n * 0.1)

train = records[:train_end]
validation = records[train_end:val_end]
test = records[val_end:]


def save_jsonl(data, path):
    with open(path, "w") as f:
        for item in data:
            f.write(json.dumps(item) + "\n")


save_jsonl(train, OUTPUT_DIR / "train.jsonl")
save_jsonl(validation, OUTPUT_DIR / "validation.jsonl")
save_jsonl(test, OUTPUT_DIR / "test.jsonl")


print("Train:", len(train))
print("Validation:", len(validation))
print("Test:", len(test))

print("\nProcessed dataset saved in:")
print(OUTPUT_DIR)