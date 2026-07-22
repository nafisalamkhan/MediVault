import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { getAllMedications, initializeDatabase } from "@/lib/db";
import type { Medication } from "@/lib/db/schema";

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      const currentRequest = ++requestIdRef.current;
      setLoading(true);
      setLoadError(null);

      async function load() {
        try {
          await initializeDatabase();
          const data = await getAllMedications(userId!);
          if (requestIdRef.current === currentRequest) {
            setMedications(data);
            setLoadError(null);
          }
        } catch (err: any) {
          if (requestIdRef.current === currentRequest) {
            setLoadError(
              err.message || "Failed to load medications. Please try again."
            );
          }
        } finally {
          if (requestIdRef.current === currentRequest) {
            setLoading(false);
          }
        }
      }

      load();
      return () => {
        requestIdRef.current = ++requestIdRef.current;
      };
    }, [userId])
  );

  function handleRetry() {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);

    async function load() {
      try {
        await initializeDatabase();
        const data = await getAllMedications(userId!);
        if (requestIdRef.current === currentRequest) {
          setMedications(data);
          setLoadError(null);
        }
      } catch (err: any) {
        if (requestIdRef.current === currentRequest) {
          setLoadError(
            err.message || "Failed to load medications. Please try again."
          );
        }
      } finally {
        if (requestIdRef.current === currentRequest) {
          setLoading(false);
        }
      }
    }

    load();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="mt-4 text-center text-lg font-semibold text-gray-800">
          Something Went Wrong
        </Text>
        <Text className="mt-2 text-center text-sm text-gray-500">
          {loadError}
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          className="mt-6 rounded-xl bg-blue-600 px-8 py-4"
        >
          <Text className="font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 pt-14 pb-4">
        <Text className="text-3xl font-bold text-gray-900">MediVault</Text>
        <Text className="mt-1 text-base text-gray-500">
          {medications.length} medication{medications.length !== 1 ? "s" : ""} tracked
        </Text>
      </View>

      {/* Content */}
      {medications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="medkit-outline" size={80} color="#D1D5DB" />
          <Text className="mt-6 text-center text-xl font-semibold text-gray-800">
            No Medications Yet
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-500">
            Scan a medication barcode to start tracking your prescriptions.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            className="mt-8 rounded-xl bg-blue-600 px-8 py-4"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
              <Text className="font-semibold text-white">
                Scan Your First Medication
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="px-6 pb-24"
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <Card className="flex-row items-center">
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Ionicons name="medkit" size={24} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {item.name}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {item.dosage} · {item.frequency}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Card>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push("/scanner")}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg"
        activeOpacity={0.8}
      >
        <Ionicons name="scan-outline" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
