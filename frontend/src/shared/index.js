/**
 * ERP AYA Shared UI Library Barrel (frontend/src/shared/index.js)
 * Punto de importacion compartido para los modulos del ERP.
 */

import "./styles/shared-ui.css";

export { motionTokens } from "./lib/motion-tokens";
export { Icon } from "./components/Icon";
export { Button, ButtonGroup, ConfirmMorph } from "./components/Button";
export { Select } from "./components/Select";
export { Switch } from "./components/Switch";
export { SegmentedControl } from "./components/SegmentedControl";
export { FilterToolbar } from "./components/FilterToolbar";
export { Avatar, UserChip } from "./components/Avatar";
export { Badge, StatusBadge } from "./components/Badge";
export { Alert, EmptyState, Skeleton, MetricCard } from "./components/Feedback";
export { SortableDataTable, DataTable } from "./components/SortableDataTable";
export {
  FormField,
  TextInput,
  NumberInput,
  TextareaField,
  KeyValueGrid,
  EndpointBadge,
  UserStoryBanner,
} from "./components/FormControls";
export {
  Stepper,
  BultoStepper,
  RadioCards,
  PaymentStrategySelector,
  StockSplitBar,
  PlotlyReportCard,
} from "./components/DomainWidgets";
export {
  ScreenTransition,
  StaggerItem,
  Drawer,
  Modal,
  ToastStack,
} from "./components/Motion";
export { AppShell, TASK_GROUPS, ERP_MODULES, DEFAULT_LOCATIONS } from "./components/AppShell";
export { useAsync } from "./hooks/useAsync";
export { useMutation } from "./hooks/useMutation";
export { useDisclosure } from "./hooks/useDisclosure";
export { useToast, ToastProvider } from "./feedback/ToastContext";
export {
  PrototypeContext,
  PrototypeProvider,
  usePrototype,
  PROTOTYPE_SCREENS,
} from "./feedback/PrototypeContext";
export {
  WireframeSwitcher,
  WIREFRAME_SCREENS,
  resolveScreenFromPath,
} from "./components/WireframeSwitcher";
export { WireframeOverlays } from "./components/WireframeOverlays";
export { SearchableSelect } from "./components/SearchableSelect";
export { useLiveResource, LiveIndicator } from "./hooks/useLiveResource.jsx";
