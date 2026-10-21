import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const PrototypeContext = createContext(null);

export const PROTOTYPE_SCREENS = [
  "login",
  "dashboard",
  "masters",
  "wizard",
  "kanban",
  "order",
  "remito",
  "bulto",
  "trace",
  "operator",
  "reports",
];

const TOAST_DURATION_MS = 5200;

export function PrototypeProvider({ children, initialScreen = "dashboard" }) {
  const [activeScreen, setActiveScreen] = useState(initialScreen);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastSeqRef = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message) => {
      const id = toastSeqRef.current++;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        removeToast(id);
      }, TOAST_DURATION_MS);
      return id;
    },
    [removeToast]
  );

  const openDrawer = useCallback((type, data = null) => {
    setActiveDrawer(type);
    setDrawerData(data);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
    setDrawerData(null);
  }, []);

  const openModal = useCallback((type, data = null) => {
    setActiveModal(type);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  const toggleNotifications = useCallback(() => {
    setIsNotificationsOpen((prev) => !prev);
  }, []);

  const closeNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (activeDrawer) closeDrawer();
        if (activeModal) closeModal();
        if (isNotificationsOpen) closeNotifications();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawer, activeModal, isNotificationsOpen, closeDrawer, closeModal, closeNotifications]);

  const value = useMemo(
    () => ({
      activeScreen,
      setActiveScreen,
      activeDrawer,
      drawerData,
      openDrawer,
      closeDrawer,
      activeModal,
      modalData,
      openModal,
      closeModal,
      isNotificationsOpen,
      toggleNotifications,
      closeNotifications,
      toasts,
      toast,
      removeToast,
    }),
    [
      activeScreen,
      activeDrawer,
      drawerData,
      openDrawer,
      closeDrawer,
      activeModal,
      modalData,
      openModal,
      closeModal,
      isNotificationsOpen,
      toggleNotifications,
      closeNotifications,
      toasts,
      toast,
      removeToast,
    ]
  );

  return (
    <PrototypeContext.Provider value={value}>
      {children}
    </PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const ctx = useContext(PrototypeContext);
  if (!ctx) {
    throw new Error("usePrototype debe usarse dentro de PrototypeProvider");
  }
  return ctx;
}

export default PrototypeContext;
