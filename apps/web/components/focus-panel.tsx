"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
export function FocusPanel({
  title,
  art,
  children,
  tone = "yellow",
}: {
  title: string;
  art: ReactNode;
  children: ReactNode;
  tone?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = title.toLowerCase().replaceAll(/[^a-z]+/g, "-");
  return (
    <>
      <motion.button
        layoutId={`focus-${id}`}
        className={`experiment-card ${tone}`}
        data-cursor="Explore"
        onClick={() => setOpen(true)}
      >
        <div className="experiment-art">{art}</div>
        <h2>{title}</h2>
        <span>Open experiment ↗</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <FocusDialog id={id} title={title} onClose={() => setOpen(false)}>
            {children}
          </FocusDialog>
        )}
      </AnimatePresence>
    </>
  );
}
function FocusDialog({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="focus-dialog"
      aria-labelledby={`title-${id}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        layoutId={`focus-${id}`}
        className="focus-content"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 30, stiffness: 260 }}
      >
        <div className="focus-heading">
          <h2 id={`title-${id}`}>{title}</h2>
          <button autoFocus aria-label={`Close ${title}`} onClick={onClose}>
            Close ×
          </button>
        </div>
        {children}
      </motion.div>
    </dialog>
  );
}
