import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingCart, PackageSearch, LayoutDashboard, FileText, BookOpen } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/store/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BillingScreen from './src/screens/BillingScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import { ActivityIndicator, View } from 'react-native';

const Tab = createBottomTabNavigator();

function MainNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Billing"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB', // Deep Blue
        tabBarInactiveTintColor: '#94A3B8', // Slate Gray
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0', // Slate 200
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
          backgroundColor: '#FFFFFF',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Billing" 
        component={BillingScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Inventory" 
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => <PackageSearch color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Ledger" 
        component={LedgerScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Reports" 
        component={SalesReportScreen}
        options={{
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}

function RootComponent() {
  const { state } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const auth = await AsyncStorage.getItem('cs_auth_session');
        if (auth === 'true') {
          setIsAuthenticated(true);
        }
      } catch (e) {
        // ignore
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  if (state.loading || checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootComponent />
      </AppProvider>
    </SafeAreaProvider>
  );
}
