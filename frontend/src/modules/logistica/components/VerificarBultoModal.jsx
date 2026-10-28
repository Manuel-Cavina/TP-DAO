import React, { useState } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput } from "../../../shared/components/FormControls";
import { Switch } from "../../../shared/components/Switch";
import { Alert } from "../../../shared/components/Feedback";

export function VerificarBultoModal({ open, onClose, bulto, onSubmit, pending = false }) {
  const [codigoPrecinto, setCodigoPrecinto] = useState("");
  const [estaIntacto, setEstaIntacto] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!codigoPrecinto.trim()) return;
    const res = await onSubmit({
      bultoId: bulto?.id,
      codigoPrecinto: codigoPrecinto.trim(),
      estaIntacto,
    });
    if (res?.ok) {
      setCodigoPrecinto("");
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verificación física de bulto en destino (P6)"
      subtitle={`Bulto #${bulto?.id || ""} · Remito: ${bulto?.remitoNumero || ""}`}
      footer={
        <div className="row justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant={estaIntacto ? "primary" : "danger"}
            onClick={handleSubmit}
            loading={pending}
            loadingLabel="Registrando control..."
          >
            {estaIntacto ? "Acreditar como verificado" : "Rechazar por merma (V1)"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-4">
        <TextInput
          label="Código de precinto recibido"
          required
          mono
          value={codigoPrecinto}
          onChange={(e) => setCodigoPrecinto(e.target.value)}
          placeholder="p. ej. PRC-2026-0001"
          hint="Debe coincidir con la faja colocada en CD"
        />

        <Switch
          checked={estaIntacto}
          onChange={setEstaIntacto}
          label="Faja de seguridad y precinto intactos"
          description="Si la faja fue violada o el precinto no coincide, el bulto se rechaza y pasa a merma."
        />

        {!estaIntacto && (
          <Alert
            tone="danger"
            title="Regla de negocio V1: Registro de merma"
            description="Al rechazar el bulto por precinto violado, la mercadería se registrará como merma en logística y NO se acreditará al stock disponible vendible del local comercial."
          />
        )}
      </form>
    </Modal>
  );
}
