import { useEffect, useRef, useCallback, createContext, useContext, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { MaterialIcons } from "@expo/vector-icons";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast overlay */}
      <View style={styles.overlay} pointerEvents="none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity]);

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, borderLeftColor: config.color },
      ]}
    >
      <MaterialIcons name={config.icon as any} size={18} color={config.color} />
      <Text style={styles.toastText} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const TOAST_CONFIG: Record<ToastType, { color: string; icon: string }> = {
  success: { color: "#16A34A", icon: "check-circle" },
  error: { color: "#DC2626", icon: "error" },
  info: { color: "#2563EB", icon: "info" },
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
});
