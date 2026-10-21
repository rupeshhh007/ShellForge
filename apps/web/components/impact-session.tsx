"use client";
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  seedFilesystem,
  type Snapshot,
  type Change,
} from "@/lib/impact/engine";
type Applied = { command: string; changes: Change[]; revision: number } | null;
type Session = {
  snapshot: Snapshot;
  setSnapshot: Dispatch<SetStateAction<Snapshot>>;
  history: Snapshot[];
  setHistory: Dispatch<SetStateAction<Snapshot[]>>;
  applied: Applied;
  setApplied: Dispatch<SetStateAction<Applied>>;
  lastCommand: string;
  setLastCommand: Dispatch<SetStateAction<string>>;
};
const Context = createContext<Session | null>(null);
export function ImpactSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(seedFilesystem);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [applied, setApplied] = useState<Applied>(null);
  const [lastCommand, setLastCommand] = useState(
    "find ./data -type f -size +100M",
  );
  return (
    <Context.Provider
      value={{
        snapshot,
        setSnapshot,
        history,
        setHistory,
        applied,
        setApplied,
        lastCommand,
        setLastCommand,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useImpactSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Impact session provider is missing");
  return context;
}
