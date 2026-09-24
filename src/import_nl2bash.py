import json
from pathlib import Path

NL_FILE = Path("data/nl2bash/all.nl")
CMD_FILE = Path("data/nl2bash/all.cm")
OUTPUT_FILE = Path("data/nl2bash_sample.jsonl")

LIMIT = 100


def basic_risk(command):
    cmd = command.lower()

    dangerous = [
        "rm -rf",
        "mkfs",
        "dd ",
        "shutdown",
        "reboot",
        "kill -9",
    ]

    caution = [
        "sudo ",
        "chmod ",
        "chown ",
        "kill ",
        "rm ",
    ]

    for pattern in dangerous:
        if pattern in cmd:
            return "DANGEROUS"

    for pattern in caution:
        if pattern in cmd:
            return "CAUTION"

    return "SAFE"


with open(NL_FILE) as nl_file, \
     open(CMD_FILE) as cmd_file, \
     open(OUTPUT_FILE, "w") as out:

    count = 0

    for instruction, command in zip(nl_file, cmd_file):

        instruction = instruction.strip()
        command = command.strip()

        if not instruction or not command:
            continue

        record = {
            "instruction": instruction,
            "command": command,
            "category": "unclassified",
            "risk": basic_risk(command),
            "explanation": "",
            "safe_alternative": None
        }

        out.write(json.dumps(record) + "\n")

        count += 1

        if count >= LIMIT:
            break


print(f"Imported {count} NL2Bash examples.")
print(f"Saved to {OUTPUT_FILE}")