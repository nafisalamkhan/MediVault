import * as SecureStore from "expo-secure-store";
import { TokenCache } from "@clerk/clerk-expo";

export const tokenCache: TokenCache = {
  getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  setToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  deleteToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};
