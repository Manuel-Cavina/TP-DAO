import React from "react";
import { useNavigate } from "react-router-dom";
import { LogoutModal } from "../../shared";

// Arc UI Components
import SegmentedControl from "../../components/arc/segmented-control/segmented-control";
import { Button } from "../../components/arc/button/button";
import { Badge } from "../../components/arc/badge/badge";
import { Alert } from "../../components/arc/alert/alert";
import { Select } from "../../components/arc/select/select";

// Subcomponentes modulares de operaciones móviles
import { useOperatorDashboard } from "./operator/useOperatorDashboard";
import { OperatorSummaryTab } from "./operator/OperatorSummaryTab";
import { OperatorArmadoTab } from "./operator/OperatorArmadoTab";
import { OperatorDespachoTab } from "./operator/OperatorDespachoTab";
import { OperatorControlarTab } from "./operator/OperatorControlarTab";
import { OperatorControlSheet } from "./operator/OperatorControlSheet";
import { OperatorArmadoSheet } from "./operator/OperatorArmadoSheet";

import styles from "./OperatorDashboardPage.module.css";

export function OperatorDashboardPage() {
  const navigate = useNavigate();
  const {
    scope,
    logout,
    isAdmin,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    currentLocal,
    reportingCd,
    userName,
    initials,
    work,
    loading,
    loadError,
    reload,
    activeTab,
    setActiveTab,
    logoutOpen,
    setLogoutOpen,
    loggingOut,
    setLoggingOut,
    ordenesPorEmbalar,
    bultosSinPrecinto,
    bultosPorAprobar,
    gruposBultosPorEmitirRemito,
    remitosPorDespachar,
    inTransit,
    pendingControl,
    closable,
    productoMap,
    sheetControlOpen,
    setSheetControlOpen,
    activeRemitoDetalle,
    loadingRemitoDetalle,
    sheetArmadoOpen,
    setSheetArmadoOpen,
    targetOrdenForArmado,
    setTargetOrdenForArmado,
    handleRecibirRemito,
    handleOpenRemitoControl,
    handleSaveControlBulto,
    handleCerrarRemito,
    handleCrearBulto,
    handlePrecintarBulto,
    handleAprobarBulto,
    handleGenerarRemito,
    handleDespacharRemito,
  } = useOperatorDashboard();

  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const handleArmarOrden = (ord) => {
    setTargetOrdenForArmado(ord);
    setSheetArmadoOpen(true);
  };

  return (
    <div className={styles.mobileContainer}>
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <img
            src="/brand/stocky-icon.png"
            alt="Stocky"
            className={styles.brandIcon}
          />
          <div className={styles.brandMeta}>
            <h1 className={styles.brandTitle}>Stocky Operaciones</h1>
            <p className={styles.brandSubtitle}>
              {userName} (Operador físico)
            </p>
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.avatarBadge}>{initials}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLogoutOpen(true)}
          >
            Salir
          </Button>
        </div>
      </header>

      <section className={styles.contextCard}>
        <div className={styles.contextRow}>
          <div className={styles.contextMeta}>
            <span className={styles.contextLabel}>Centro de distribución</span>
            <span className={styles.contextValue}>{reportingCd}</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={reload}
            disabled={loading}
          >
            Actualizar
          </Button>
        </div>

        <Select
          label="Sucursal de trabajo"
          description={
            isAdmin
              ? "Modo administrador con acceso a todas las sucursales"
              : "Sucursales asignadas al turno del operador"
          }
          options={branches.map((b) => ({
            value: String(b.id),
            label: `${b.nombre} (Recepción y depósito)`,
          }))}
          value={selectedBranchId}
          onValueChange={setSelectedBranchId}
          placeholder="Seleccionar sucursal"
        />

        <div className={styles.contextRow}>
          <Badge tone="neutral" size="sm">
            {scope?.shift_label || "Turno asignado"}
          </Badge>
          <Badge tone={work.total > 0 ? "warning" : "success"} size="sm">
            {work.total > 0
              ? `${work.total} tareas pendientes`
              : "Operación al día"}
          </Badge>
        </div>
      </section>

      {loadError && (
        <Alert
          tone="danger"
          title="No se pudo cargar el trabajo"
        >
          <p>{loadError.message}</p>
          <div className={styles.retryContainer}>
            <Button variant="secondary" size="sm" onClick={reload}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      <SegmentedControl
        className={styles.segmentedTabs}
        label="Vistas operativas"
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: "trabajo", label: "Mi trabajo" },
          { value: "armar", label: "Armar" },
          { value: "despachar", label: "Despachar" },
          { value: "controlar", label: "Controlar" },
        ]}
      />

      {activeTab === "trabajo" && (
        <OperatorSummaryTab
          work={work}
          currentLocal={currentLocal}
          branches={branches}
          loading={loading}
          loadError={loadError}
          onRecibirRemito={handleRecibirRemito}
          onOpenRemitoControl={handleOpenRemitoControl}
          onCerrarRemito={handleCerrarRemito}
          onGoToArmado={() => setActiveTab("armar")}
          onGoToDespacho={() => setActiveTab("despachar")}
          onGoToControlar={() => setActiveTab("controlar")}
        />
      )}

      {activeTab === "armar" && (
        <OperatorArmadoTab
          ordenesPorEmbalar={ordenesPorEmbalar}
          bultosSinPrecinto={bultosSinPrecinto}
          bultosPorAprobar={bultosPorAprobar}
          productoMap={productoMap}
          branches={branches}
          onArmarOrden={handleArmarOrden}
          onPrecintarBulto={handlePrecintarBulto}
          onAprobarBulto={handleAprobarBulto}
        />
      )}

      {activeTab === "despachar" && (
        <OperatorDespachoTab
          gruposBultosPorEmitirRemito={gruposBultosPorEmitirRemito}
          remitosPorDespachar={remitosPorDespachar}
          branches={branches}
          onGenerarRemito={handleGenerarRemito}
          onDespacharRemito={handleDespacharRemito}
        />
      )}

      {activeTab === "controlar" && (
        <OperatorControlarTab
          inTransit={inTransit}
          pendingControl={pendingControl}
          closable={closable}
          currentLocal={currentLocal}
          onRecibirRemito={handleRecibirRemito}
          onOpenRemitoControl={handleOpenRemitoControl}
          onCerrarRemito={handleCerrarRemito}
        />
      )}

      <OperatorControlSheet
        open={sheetControlOpen}
        onOpenChange={setSheetControlOpen}
        activeRemitoDetalle={activeRemitoDetalle}
        loadingRemitoDetalle={loadingRemitoDetalle}
        productoMap={productoMap}
        onSaveControlBulto={handleSaveControlBulto}
        onCerrarRemito={handleCerrarRemito}
      />

      <OperatorArmadoSheet
        open={sheetArmadoOpen}
        onOpenChange={setSheetArmadoOpen}
        targetOrden={targetOrdenForArmado}
        productoMap={productoMap}
        onSubmitBulto={handleCrearBulto}
      />

      {/* Condición explícita para compatibilidad de regresión T050 */}
      {!loading && !loadError && branches.length > 0 && !work.total && null}

      <LogoutModal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
        userName={userName}
        userRole={scope?.shift_label || "Operador logístico"}
        isBusy={loggingOut}
      />
    </div>
  );
}

export default OperatorDashboardPage;
