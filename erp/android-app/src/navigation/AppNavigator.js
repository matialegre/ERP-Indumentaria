import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import IngresoScreen from "../screens/IngresoScreen";
import RecepcionScreen from "../screens/RecepcionScreen";
import PedidosScreen from "../screens/PedidosScreen";
import ProveedoresScreen from "../screens/ProveedoresScreen";
import ProfileScreen from "../screens/ProfileScreen";
import IngresoDetailScreen from "../screens/IngresoDetailScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TABS = [
  { name: "Dashboard", component: DashboardScreen, icon: "grid-outline", iconActive: "grid" },
  { name: "Ingresos", component: IngresoScreen, icon: "archive-outline", iconActive: "archive" },
  { name: "Recepción", component: RecepcionScreen, icon: "checkmark-circle-outline", iconActive: "checkmark-circle" },
  { name: "Pedidos", component: PedidosScreen, icon: "cart-outline", iconActive: "cart" },
  { name: "Proveedores", component: ProveedoresScreen, icon: "people-outline", iconActive: "people" },
];

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1e293b",
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        headerShown: false,
      })}
    >
      {TABS.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="IngresoDetail"
              component={IngresoDetailScreen}
              options={{ headerShown: true, title: "Detalle Ingreso", headerStyle: { backgroundColor: "#0f172a" }, headerTintColor: "#fff" }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: true, title: "Mi Perfil", headerStyle: { backgroundColor: "#0f172a" }, headerTintColor: "#fff" }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
