import React, { useState, useEffect } from "react";
import { Modal } from "../../../shared/components/Motion";
import { Button } from "../../../shared/components/Button";
import { TextInput, TextareaField } from "../../../shared/components/FormControls";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Alert } from "../../../shared/components/Feedback";
import { validateSealControl } from "../mappers/sealControl";

export function VerificarBultoModal({ open, onClose, bulto, onSubmit, pending = false }) {
  const [codigoPrecinto, setCodigoPrecinto] = useState("");
  const [resultado, setResultado] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [error, setError] = useState("");
  const estaIntacto = resultado === "INTACTO";
  useEffect(() => { setCodigoPrecinto(""); setResultado(""); setMotivoRechazo(""); setError(""); }, [open, bulto?.id]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const decision = validateSealControl({ precintoEsperado: bulto?.codigoPrecinto, precintoLeido: codigoPrecinto, resultado, motivoRechazo });
    if (decision.error) { setError(decision.error); return; }
    const res = await onSubmit({
      bultoId: bulto?.id,
      codigoPrecinto: codigoPrecinto.trim(),
      estaIntacto: !decision.rejected,
      motivoRechazo: decision.reason,
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
            disabled={!resultado || pending}
            loadingLabel="Registrando control..."
          >
            {estaIntacto ? "Acreditar como verificado" : "Rechazar por merma (V1)"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="stack gap-4">
        {error && <Alert tone="danger" title="Revise la verificación" description={error} />}
        <TextInput
          label="Código de precinto recibido"
          required
          mono
          value={codigoPrecinto}
          onChange={(e) => setCodigoPrecinto(e.target.value)}
          placeholder="p. ej. PRC-2026-0001"
          hint="Debe coincidir con la faja colocada en CD"
        />

        <SegmentedControl ariaLabel="Resultado de la inspección del precinto" value={resultado} onChange={setResultado} options={[{ value: "INTACTO", label: "Intacto" }, { value: "VIOLADO", label: "Violado" }]} />
        {(resultado === "VIOLADO" || (codigoPrecinto.trim() && bulto?.codigoPrecinto && codigoPrecinto.trim() !== bulto.codigoPrecinto)) && <TextareaField label="Motivo de rechazo" value={motivoRechazo} onChange={(event) => setMotivoRechazo(event.target.value)} required maxLength={250} />}

        {resultado === "VIOLADO" && (
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
