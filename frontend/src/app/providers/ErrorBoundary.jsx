import React from "react";
import { Alert } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app-error-boundary">
        <Alert tone="danger" title="No se pudo mostrar esta pantalla" description={error.message} />
        <Button variant="secondary" onClick={() => this.setState({ error: null })}>
          Reintentar
        </Button>
      </div>
    );
  }
}
