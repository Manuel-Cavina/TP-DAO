import React from "react";
import { orderWorkflowSteps } from "./workflowPresentation";

export function OrderWorkflowRail({ activeTab, onSelect, orden, remito }) {
  return (
    <nav className="logistics-workflow" aria-label="Etapas y evidencia de la orden">
      {orderWorkflowSteps(orden, remito).map((step) => (
        <button type="button" key={step.tab} aria-current={activeTab === step.tab ? "page" : undefined} onClick={() => onSelect(step.tab)}>
          <span>{step.label}</span><small>{step.detail}</small>
        </button>
      ))}
    </nav>
  );
}
