import { useEffect, useRef, useCallback, createContext, useContext, useState, type ReactNode } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, radius, typography, shadows } from "@/lib/theme";

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

export function ToastProvider({ children }: { children: ReactNode }) {
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
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity]);

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity },
        { borderLeftColor: config.color },
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
  success: { color: colors.success, icon: "check-circle" },
  error: { color: colors.danger, icon: "error" },
  info: { color: colors.primary, icon: "info" },
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.level1,
  },
  toastText: {
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    fontWeight: "400",
    color: colors.ink,
  },
});