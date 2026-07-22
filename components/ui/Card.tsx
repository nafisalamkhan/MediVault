import { View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
