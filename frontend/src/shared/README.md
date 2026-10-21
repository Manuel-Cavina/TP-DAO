# ERP AYA · Librería Compartida (`frontend/src/shared/`)

Esta carpeta concentra **todos los tokens de diseño, estilos y componentes reutilizables** basados en **Arc UI (`https://uiarc.dev`)** y **Apple Cupertino Industrial** para que los 5 módulos (`catalogo`, `ubicaciones_stock`, `logistica`, `ventas_caja`, `reportes`) mantengan exactamente el mismo patrón visual y de interacción.

## Importación Única (Barrel)

Desde cualquier vista o componente dentro de `frontend/src/modules/<modulo>/`, importa desde `../../shared`:

```jsx
import {
  AppShell,
  Icon,
  Button,
  ButtonGroup,
  ConfirmMorph,
  Select,
  Switch,
  SegmentedControl,
  FilterToolbar,
  Avatar,
  UserChip,
  Badge,
  StatusBadge,
  MetricCard,
  Alert,
  EmptyState,
  Skeleton,
  SortableDataTable,
  DataTable,
  Stepper,
  BultoStepper,
  RadioCards,
  PaymentStrategySelector,
  StockSplitBar,
  PlotlyReportCard,
  apiClient,
  motionTokens,
} from "../../shared";
```

## Estructura de `frontend/src/shared/`

- `styles/tokens.css` y `styles/foundation.css`: Tokens oficiales de Arc UI (`--background`, `--surface`, `--surface-raised`, `--surface-muted`, `--foreground`, `--text-secondary`, `--text-muted`, `--border`, `--border-subtle`, `--border-strong`, `--accent`, `--control-*`, `--radius-control`, `--radius-panel`, `--radius-surface`, `--radius-pill`, `--shadow-*`) + tokens semánticos del dominio ERP.
- `styles/shared-ui.css`: Clases base y estilos de todos los componentes compartidos.
- `lib/motion-tokens.js`: Tokens de animación y springs de Arc UI (`snappy`, `smooth`, `morph`).
- `http/api_client.js`: Cliente HTTP centralizado hacia FastAPI (`/api/v1/...`) con mapeo automático de `BusinessError` (`400`, `404`, `409`, `500`) a `Alert`.
- `components/`: Componentes React listos para usar en los 5 módulos.
