import React, { useEffect } from "react";
import { Platform, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui";
import { useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type OAuthProvider = "google" | "apple" | "facebook";

const PROVIDER_CONFIG: Record<
  OAuthProvider,
  { strategy: string; icon: string; label: string }
> = {
  google: {
    strategy: "oauth_google",
    icon: "logo-google",
    label: "Continue with Google",
  },
  apple: {
    strategy: "oauth_apple",
    icon: "logo-apple",
    label: "Continue with Apple",
  },
  facebook: {
    strategy: "oauth_facebook",
    icon: "logo-facebook",
    label: "Continue with Facebook",
  },
};

interface OAuthButtonProps {
  provider: OAuthProvider;
  onError?: (message: string) => void;
}

export function OAuthButton({ provider, onError }: OAuthButtonProps) {
  useWarmUpBrowser();
  const router = useRouter();
  const config = PROVIDER_CONFIG[provider];
  const { startOAuthFlow } = useOAuth({ strategy: config.strategy as any });

  const handlePress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL("/", { scheme: "medivault" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      const message =
        err.errors?.[0]?.longMessage ||
        err.message ||
        "OAuth sign-in failed. Please try again.";
      if (onError) {
        onError(message);
      }
    }
  }, [startOAuthFlow, router, onError]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-soft"
    >
      <Ionicons name={config.icon as any} size={20} color="#374151" />
      <Text
        className="text-sm font-semibold text-slate-700"
        style={{ fontFamily: "SpaceGrotesk_700Bold" }}
      >
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}
