import * as SecureStore from "expo-secure-store";
import { TokenCache } from "@clerk/clerk-expo";

export const tokenCache: TokenCache = {
  getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  saveToken(key: string, token: string) {
    return SecureStore.setItemAsync(key, token);
  },
  clearToken(key: string) {
    SecureStore.deleteItemAsync(key);
  },
};
