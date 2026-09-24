import { useEffect, useRef, type ReactNode } from "react";

export function UmigameDialog({ children, className, labelledBy, onDismiss, dismissOnBackdrop = false }: {
  children: ReactNode;
  className: string;
  labelledBy: string;
  onDismiss: () => void;
  dismissOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className={`umigame-dialog ${className}`}
      aria-labelledby={labelledBy}
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onDismiss();
      }}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
      {children}
    </dialog>
  );
}
