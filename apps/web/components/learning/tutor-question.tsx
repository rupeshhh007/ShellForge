"use client";
import { useState } from "react";
import { lessonById } from "@/lib/learning/cases";
import type { Prediction } from "@/lib/learning/session";
type Question = {
  mode: string;
  question: string;
  question_id: number;
  reason: string;
};
export function TutorQuestion({
  id,
  prediction,
  onHint,
}: {
  id: string;
  prediction: Prediction;
  onHint: (index: number) => void;
}) {
  const [pending, setPending] = useState(false),
    [question, setQuestion] = useState<Question | null>(null);
  async function ask() {
    setPending(true);
    try {
      const response = await fetch("/api/tutor/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: id,
          revision: lessonById(id).revision,
          ...prediction,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("Question service unavailable");
      const value = await response.json();
      if (
        !["deterministic-question", "gemini-question-selection"].includes(
          value.mode,
        ) ||
        typeof value.question !== "string" ||
        value.question.length > 1000 ||
        !Number.isInteger(value.question_id) ||
        value.question_id < 0 ||
        value.question_id > 2
      )
        throw Error("Invalid question");
      setQuestion(value);
    } catch {
      setQuestion({
        mode: "local-hint",
        question:
          "Which exact metadata would you inspect before changing your prediction? The curated clues below remain available.",
        question_id: 0,
        reason: "unavailable",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="arl-tutor">
      <button disabled={pending} onClick={ask}>
        {pending
          ? "Choosing a grounded question…"
          : "Ask for a grounded question"}
      </button>
      {question && (
        <div role="status">
          <strong>
            {question.mode === "gemini-question-selection"
              ? "Gemini selected a reviewed question"
              : question.mode === "local-hint"
                ? "Local fallback · service unavailable"
                : "Deterministic question · Gemini unavailable or limited"}
          </strong>
          <p>{question.question}</p>
          <button onClick={() => onHint(question.question_id)}>
            Open the related clue and record its use
          </button>
        </div>
      )}
      <p className="arl-caption">
        Optional Gemini can select among reviewed questions. It cannot write
        verdicts, change files, or score your answer.
      </p>
    </div>
  );
}
