import { View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-slate-200/60 bg-white p-5 shadow-soft ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
