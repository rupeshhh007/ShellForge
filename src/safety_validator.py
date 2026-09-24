DANGEROUS_PATTERNS = {
    "rm -rf": "Recursive forced deletion",
    "mkfs": "Filesystem formatting",
    "dd if=": "Raw disk operation",
    "chmod -r 777": "Recursive unrestricted permission change",
    "chown -r": "Recursive ownership modification",
    "shutdown": "System shutdown",
    "reboot": "System reboot",
    "kill -9": "Forced process termination",
}

CAUTION_PATTERNS = {
    "sudo": "Runs command with elevated privileges",
    "chmod": "Changes file permissions",
    "chown": "Changes file ownership",
    "kill ": "Terminates a process",
}


def check_command(command):
    cmd = command.lower().strip()

    dangerous_reasons = []

    for pattern, reason in DANGEROUS_PATTERNS.items():
        if pattern in cmd:
            dangerous_reasons.append(reason)

    if dangerous_reasons:
        return {
            "risk": "DANGEROUS",
            "reasons": dangerous_reasons
        }

    caution_reasons = []

    for pattern, reason in CAUTION_PATTERNS.items():
        if pattern in cmd:
            caution_reasons.append(reason)

    if caution_reasons:
        return {
            "risk": "CAUTION",
            "reasons": caution_reasons
        }

    return {
        "risk": "SAFE",
        "reasons": []
    }


if __name__ == "__main__":
    command = input("Enter shell command: ")

    result = check_command(command)

    print("\nRisk Level:", result["risk"])

    if result["reasons"]:
        print("Reason:")
        for reason in result["reasons"]:
            print("-", reason)