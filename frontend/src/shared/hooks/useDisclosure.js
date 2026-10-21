import { useCallback, useState } from "react";

export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((v) => !v), []);
  // `isOpen` was the original public name used by several screens.
  // Keep both names so every modal and drawer reads the same state.
  return { open, isOpen: open, onOpen, onClose, onToggle };
}
