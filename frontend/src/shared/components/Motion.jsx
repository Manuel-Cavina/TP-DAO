import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Button } from "./Button";

/**
 * Arc UI Motion & Screen Flow Primitives (`frontend/src/shared/components/Motion.jsx`)
 * Implements choreographed Entry (`--ease-enter`), Exit (`--ease-exit`),
 * Staggered Cascades, Slide-Over Drawers, and Scale-Blur Modals.
 */

export function ScreenTransition({
  screenKey,
  mode = "screen", // "screen" | "step"
  children,
  className = "",
}) {
  const [displayedKey, setDisplayedKey] = useState(screenKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState("enter"); // "enter" | "exit"

  useEffect(() => {
    if (screenKey !== displayedKey) {
      setPhase("exit");
      const timer = setTimeout(() => {
        setDisplayedKey(screenKey);
        setDisplayedChildren(children);
        setPhase("enter");
      }, 135);
      return () => clearTimeout(timer);
    } else {
      setDisplayedChildren(children);
    }
  }, [screenKey, children, displayedKey]);

  const animClass =
    phase === "exit"
      ? "arc-screen-exit"
      : mode === "step"
      ? "arc-step-enter"
      : "arc-screen-enter";

  return (
    <div
      key={displayedKey}
      className={`arc-screen-flow ${animClass} ${className}`.trim()}
    >
      {displayedChildren}
    </div>
  );
}

export function StaggerItem({ index = 0, children, className = "" }) {
  const itemRef = useRef(null);

  useLayoutEffect(() => {
    if (itemRef.current) {
      itemRef.current.style.setProperty("--stagger-index", index);
    }
  }, [index]);

  return (
    <div
      ref={itemRef}
      className={`arc-stagger-item ${className}`.trim()}
    >
      {children}
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function useOverlayFocus({ open, mounted, closing, onCloseRef, panelRef, isBusy }) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (!triggerRef.current) {
        triggerRef.current = document.activeElement;
      }
    }
  }, [open]);

  useEffect(() => {
    if (!mounted || closing) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      if (!panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panelRef.current.focus?.();
      }
    }, 20);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isBusy) onCloseRef.current?.();
        return;
      }

      if (event.key === "Tab") {
        if (!panelRef.current) return;
        const focusables = Array.from(
          panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (
            document.activeElement === firstEl ||
            !panelRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            lastEl.focus();
          }
        } else {
          if (
            document.activeElement === lastEl ||
            !panelRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const el = triggerRef.current;
      triggerRef.current = null;
      el?.focus?.();
    };
  }, [mounted, closing, onCloseRef, panelRef, isBusy]);
}

export function Drawer({
  open = false,
  onClose,
  title,
  subtitle,
  badge,
  header,
  footer,
  className = "",
  bodyClassName = "",
  ariaLabel,
  isBusy = false,
  children,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 170);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  useOverlayFocus({ open, mounted, closing, onCloseRef, panelRef, isBusy });

  if (!mounted) return null;

  const accessibleTitle =
    ariaLabel || (typeof title === "string" ? title : undefined);

  return createPortal(
    <div
      className={`arc-drawer-backdrop ${closing ? "is-closing" : ""}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose && !isBusy) onClose();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleTitle}
        tabIndex={-1}
        className={`arc-drawer ${closing ? "is-closing" : ""} ${className}`.trim()}
      >
        {header ? (
          header
        ) : (
          <header className="arc-drawer__header">
            <div className="arc-drawer__titles">
              <div className="row align-center gap-2">
                <h2 className="arc-drawer__title">{title}</h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-secondary">
                  {subtitle}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Cerrar panel lateral"
              onClick={onClose}
              disabled={isBusy}
            >
              <Icon name="x" size={16} />
            </Button>
          </header>
        )}

        <div className={`arc-drawer__body ${bodyClassName}`.trim()}>{children}</div>

        {footer && <footer className="arc-drawer__footer">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

export function Modal({
  open = false,
  onClose,
  title,
  subtitle,
  badge,
  header,
  nav,
  footer,
  size = "md",
  className = "",
  bodyClassName = "",
  ariaLabel,
  isBusy = false,
  children,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 145);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  useOverlayFocus({ open, mounted, closing, onCloseRef, panelRef, isBusy });

  if (!mounted) return null;

  const accessibleTitle =
    ariaLabel || (typeof title === "string" ? title : undefined);

  return createPortal(
    <div
      className={`arc-modal-backdrop ${closing ? "is-closing" : ""}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose && !isBusy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleTitle}
        tabIndex={-1}
        className={`arc-modal arc-modal--${size} ${closing ? "is-closing" : ""} ${className}`.trim()}
      >
        {header ? (
          header
        ) : title ? (
          <header className="arc-modal__header arc-drawer__header">
            <div>
              <div className="row align-center gap-2">
                <h2 className="arc-modal__title arc-drawer__title">{title}</h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-secondary">
                  {subtitle}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Cerrar modal"
              onClick={onClose}
              disabled={isBusy}
            >
              <Icon name="x" size={16} />
            </Button>
          </header>
        ) : null}

        {nav}

        <div className={`arc-modal__body arc-drawer__body ${bodyClassName}`.trim()}>
          {children}
        </div>

        {footer && (
          <footer className="arc-modal__footer arc-drawer__footer">{footer}</footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="arc-toast-stack" role="region" aria-label="Notificaciones del sistema">
      {toasts.map((t) => {
        const iconToneClass =
          t.tone === "danger"
            ? "arc-toast__icon--danger"
            : t.tone === "warning"
            ? "arc-toast__icon--warning"
            : "";
        return (
          <div key={t.id} className="arc-toast">
            <div className="arc-toast__main">
              <Icon
                name={
                  t.tone === "danger"
                    ? "shield-off"
                    : t.tone === "warning"
                    ? "alert-triangle"
                    : "shield-check"
                }
                size={16}
                className={`arc-toast__icon ${iconToneClass}`.trim()}
              />
              <div>
                <div className="font-medium text-primary">
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-xs text-secondary">
                    {t.description}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="erp-btn erp-btn--ghost erp-btn--sm"
              onClick={() => onDismiss && onDismiss(t.id)}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
