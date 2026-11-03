import React from "react";
import { Modal } from "./Motion";
import { Button } from "./Button";
import { Avatar } from "./Avatar";

/**
 * LogoutModal: Modal de confirmación para cerrar sesión de usuario u operador.
 * Arc UI + Apple Cupertino precision:
 * - Focus-trapped accessible dialog
 * - Sentence-case typography
 * - Clean destructive confirmation action
 */
export function LogoutModal({
  open = false,
  onClose,
  onConfirm,
  userName = "Usuario",
  userRole = "Administrador",
  isBusy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Cerrar sesión?"
      subtitle="Confirmá para salir de tu cuenta de forma segura"
      size="sm"
      isBusy={isBusy}
      footer={
        <div className="row justify-end align-center gap-2 w-full">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            iconLeft="log-out"
            onClick={onConfirm}
            loading={isBusy}
            loadingLabel="Cerrando..."
          >
            Cerrar sesión
          </Button>
        </div>
      }
    >
      <div className="stack gap-4 py-2">
        <div className="card p-3 row align-center gap-3 bg-surface-muted">
          <Avatar name={userName} size="md" status="online" />
          <div className="stack gap-1">
            <span className="font-medium text-sm">{userName}</span>
            <span className="text-xs text-secondary">{userRole}</span>
          </div>
        </div>
        <p className="text-sm text-secondary">
          Se cerrará tu sesión activa en este puesto de trabajo. Todos los cambios
          guardados se mantendrán seguros y sincronizados con el servidor.
        </p>
      </div>
    </Modal>
  );
}

export default LogoutModal;
