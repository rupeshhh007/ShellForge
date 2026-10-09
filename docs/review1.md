# ShellForge
## A Fine-Tuned LLM for Safe Natural-Language Linux Command Generation

---

# 1. Introduction

Linux shell commands are powerful but difficult to remember correctly,
especially when commands contain multiple flags, pipes and utilities.

General-purpose LLMs can generate Linux commands from natural-language
instructions, but generated commands may sometimes be incorrect or unsafe.

ShellForge focuses on converting natural-language Linux tasks into suitable
shell commands while adding a separate safety-validation layer.

Example:

Input:
Find all log files older than 30 days.

Command:
find /var/log -type f -name "*.log" -mtime +30

For destructive commands, ShellForge will identify the risk and provide
a safer preview whenever possible.

---

# 2. Literature Review

### NL2Bash - Lin et al. (2018)
Introduced a natural-language-to-Bash dataset and semantic parsing system.
It established NL-to-shell translation as a research problem.

Gap:
The main focus is command generation rather than explicit command safety.

### LoRA - Hu et al. (2021)
Introduced Low-Rank Adaptation for parameter-efficient fine-tuning of
large language models.

Relevance:
Allows ShellForge to fine-tune a compact LLM using limited cloud GPU resources.

### Code Llama - Roziere et al. (2023)
Demonstrated the effectiveness of language models specialized for
programming and code-generation tasks.

Gap:
It is general-purpose code generation rather than safety-aware Linux
command generation.

### Research Gap

Existing work addresses natural-language command generation and efficient
fine-tuning, but ShellForge combines:

Natural Language → Shell Command → Safety Validation → Explanation/Safe Alternative

---

# 3. Objective

The main objective is to develop a lightweight fine-tuned LLM that converts
natural-language Linux tasks into correct and safer shell commands.

Specific objectives:

- Generate Linux commands from English instructions.
- Fine-tune a compact open-source model for this task.
- Classify generated commands as SAFE, CAUTION or DANGEROUS.
- Detect potentially destructive commands.
- Provide safer alternatives where possible.
- Explain generated commands.
- Compare the fine-tuned model with the original base model.

---

# 4. Dataset Collection

Two sources are currently used.

### Manually Curated Data
20 manually verified Linux command examples were created using the
ShellForge dataset structure.

### NL2Bash Dataset
The public NL2Bash corpus was identified as the main external dataset source.

For the Review-1 pilot experiment, 100 NL2Bash samples were imported.

Current pilot dataset:

Manual samples: 20
NL2Bash samples: 100
Total: 120

Current risk distribution:

SAFE: 92
CAUTION: 24
DANGEROUS: 4

Current category distribution includes:

- Process management
- Permissions
- Text processing
- File operations
- File search
- Networking
- System monitoring
- Compression
- Navigation

The current dataset is only a pilot dataset.
The final dataset will be expanded and manually reviewed before training.

---

# 5. Dataset Processing

The implemented preprocessing pipeline performs:

Raw Dataset
      ↓
JSON Validation
      ↓
Required Field Validation
      ↓
Text Normalization
      ↓
Duplicate Removal
      ↓
Category / Risk Validation
      ↓
Random Shuffle
      ↓
Train / Validation / Test Split

Current pilot split:

Training: 96 samples (80%)
Validation: 12 samples (10%)
Testing: 12 samples (10%)

The test set will remain unseen during fine-tuning.

---

# 6. Model Architecture Design

Proposed architecture:

Natural-Language Request
          ↓
   Fine-Tuned LLM
          ↓
 Generated Shell Command
          ↓
    Safety Validator
          ↓
   ┌───────────────┐
   │               │
 SAFE            RISKY
   │               │
   │        Warning + Safer Preview
   │               │
   └───────┬───────┘
           ↓
      Final Response
 Command + Risk + Explanation


A compact open-source instruction model from the Qwen family is currently
being considered as the base model.

Fine-tuning will use LoRA/QLoRA on a cloud GPU rather than local hardware.

An initial rule-based safety validator has already been implemented.

It currently checks potentially risky patterns involving operations such as:

- rm -rf
- chmod
- chown
- kill -9
- reboot
- shutdown
- mkfs
- dd

The validator currently supports three levels:

SAFE
CAUTION
DANGEROUS

---

# 7. Conclusion

During Review 1, the project problem and architecture were finalized.

A 120-record pilot dataset has been prepared using manually curated examples
and samples from the NL2Bash corpus.

A preprocessing pipeline has been implemented to validate, normalize,
deduplicate and split the dataset.

An initial shell-command safety validator has also been implemented.

The next phase will focus on:

1. Expanding and manually reviewing the dataset.
2. Finalizing the compact base model.
3. Fine-tuning using LoRA/QLoRA.
4. Evaluating the base and fine-tuned models.
5. Integrating command generation with the safety validator.i