import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useToast } from "../../shared/feedback/ToastContext";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login, isAuthenticated, user, isLoading } = useAuth();

  const [role, setRole] = useState("Administrador");
  const [email, setEmail] = useState("admin@stocky.local");
  const [password, setPassword] = useState("stocky-demo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const destination =
        user.role === "OPERADOR"
          ? "/operador"
          : location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    }
  }, [isLoading, isAuthenticated, user, location, navigate]);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setFormError(null);
    setFieldErrors({});
    if (selectedRole === "Administrador") {
      setEmail("admin@stocky.local");
      setPassword("stocky-demo");
    } else {
      setEmail("operador@stocky.local");
      setPassword("stocky-demo");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextFieldErrors = {};
    if (!email.trim()) nextFieldErrors.email = "Ingresá tu usuario.";
    if (!password) nextFieldErrors.password = "Ingresá tu contraseña.";
    else if (password.length < 8) nextFieldErrors.password = "La contraseña debe tener al menos 8 caracteres.";
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const loggedUser = await login(email, password);
      const displayName = loggedUser.displayName || loggedUser.name || loggedUser.login;
      toast(`Sesión iniciada: ${displayName}`);

      const destination =
        loggedUser.role === "OPERADOR"
          ? "/operador"
          : location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch {
      const errorMessage = "Credenciales incorrectas o usuario no autorizado.";
      setFormError(errorMessage);
      toast(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screen no-shell active" id="login">
      <div className="login-shell">
        <div className="login-story">
          <div className="brand">
            <img src="/brand/stocky-full.png" alt="Stocky" className="login-logo-image" />
          </div>
          <div>
            <h1>Operación trazable desde el centro hasta cada local.</h1>
            <p className="muted login-story-desc">
              Preparación, precintos, remitos, recepción y stock en un flujo verificable.
            </p>
          </div>
          <p className="micro">Entorno de aprobación · Datos demostrativos</p>
        </div>
        <div className="login-panel">
          <form className="login-card" id="loginForm" onSubmit={handleSubmit}>
            <div className="login-card-head">
              <img src="/brand/stocky-icon.png" alt="Stocky" className="login-card-logo" />
              <span>Stocky ERP</span>
            </div>
            <h1>Ingresar</h1>
            <p className="muted">El rol determina la navegación, los centros y las acciones disponibles.</p>

            {formError && (
              <div className="validation-note validation-note-error" role="alert">
                {formError}
              </div>
            )}

            <div className="role-choice" aria-label="Rol de demostración">
              <button
                type="button"
                className={`role-card ${role === "Administrador" ? "active" : ""}`}
                data-role="Administrador"
                onClick={() => handleRoleChange("Administrador")}
              >
                <strong>Administrador</strong>
                <br />
                <span className="micro">Red completa y todas las acciones</span>
              </button>
              <button
                type="button"
                className={`role-card ${role === "Operador" ? "active" : ""}`}
                data-role="Operador"
                onClick={() => handleRoleChange("Operador")}
              >
                <strong>Operador</strong>
                <br />
                <span className="micro">Trabajo asignado por sede</span>
              </button>
            </div>
            <div className="field">
              <label htmlFor="loginEmail">Usuario</label>
              <input
                className="input"
                id="loginEmail"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                  setFieldErrors((errors) => ({ ...errors, email: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "loginEmailError" : undefined}
                required
              />
              {fieldErrors.email && <span id="loginEmailError" className="field-error">{fieldErrors.email}</span>}
            </div>
            <div className="field login-field-password">
              <label htmlFor="loginPassword">Contraseña</label>
              <input
                className="input"
                id="loginPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError(null);
                  setFieldErrors((errors) => ({ ...errors, password: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "loginPasswordError" : undefined}
                required
                minLength={8}
              />
              {fieldErrors.password && <span id="loginPasswordError" className="field-error">{fieldErrors.password}</span>}
              <span className="field-help">
                Mínimo 8 caracteres. Nunca se muestra ni se registra en el prototipo.
              </span>
            </div>
            <button
              className="button primary login-submit-btn"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Ingresando..." : `Ingresar como ${role.toLowerCase()}`}
            </button>
            <p className="micro login-micro-note">
              Cuentas mínimas previstas: 1 administrador y 1 operador. En producción, permisos verificados también por backend.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
