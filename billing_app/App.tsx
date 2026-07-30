import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Modal, TouchableWithoutFeedback, StyleSheet, Dimensions } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingCart, PackageSearch, LayoutDashboard, FileText, BookOpen, Globe, Users, MessageCircle, MapPin, FileSpreadsheet, BarChart2 } from 'lucide-react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AppProvider, useApp } from './src/store/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BillingScreen from './src/screens/BillingScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';
import PurchaseHistoryScreen from './src/screens/PurchaseHistoryScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AssetsScreen from './src/screens/AssetsScreen';
import EnquiriesScreen from './src/screens/EnquiriesScreen';
import WarehousesScreen from './src/screens/WarehousesScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import ImportScreen from './src/screens/ImportScreen';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

const DRAWER_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Billing', icon: ShoppingCart },
  { name: 'Purchase Entry', icon: ShoppingCart },
  { name: 'Purchase History', icon: BookOpen },
  { name: 'Reports', icon: BarChart2 },
  { name: 'Customers', icon: Users },
  { name: 'Enquiries', icon: MessageCircle },
  { name: 'Ledger', icon: BookOpen },
  { name: 'Inventory', icon: PackageSearch },
  { name: 'Warehouses', icon: MapPin },
  { name: 'Assets', icon: BookOpen },
  { name: 'Import', icon: FileSpreadsheet },
  { name: 'Settings', icon: Globe },
];

function CustomSidebar() {
  const { isDrawerOpen, setDrawerOpen, state: appState, setLang, t } = useApp();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation();

  useEffect(() => {
    if (isDrawerOpen) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen && slideAnim._value === -DRAWER_WIDTH) return null;

  return (
    <Modal visible={isDrawerOpen} transparent animationType="none" onRequestClose={() => setDrawerOpen(false)}>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={() => setDrawerOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        
        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }], paddingTop: insets.top }]}>
          {/* Header & Language Toggle */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 12 }}>
              COSMO <Text style={{ color: '#2563EB' }}>STORE</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <Globe size={16} color="#2563EB" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                {t('Language')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.langBtn, appState.lang === 'en' && styles.langBtnActive]}
                onPress={() => setLang('en')}
              >
                <Text style={[styles.langText, appState.lang === 'en' && styles.langTextActive]}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, appState.lang === 'hi' && styles.langBtnActive]}
                onPress={() => setLang('hi')}
              >
                <Text style={[styles.langText, appState.lang === 'hi' && styles.langTextActive]}>हिंदी</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Items */}
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            {DRAWER_ITEMS.map((item) => (
              <TouchableOpacity 
                key={item.name}
                style={styles.drawerItem}
                onPress={() => {
                  setDrawerOpen(false);
                  navigation.navigate(item.name);
                }}
              >
                <item.icon color="#475569" size={22} />
                <Text style={styles.drawerItemText}>{t(item.name) || item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            height: 60 + insets.bottom,
            paddingBottom: 5 + insets.bottom,
            paddingTop: 5,
            backgroundColor: '#FFFFFF',
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' }
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('Dashboard'), tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
        <Tab.Screen name="Billing" component={BillingScreen} options={{ tabBarLabel: t('Billing'), tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} /> }} />
        <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarLabel: t('Inventory'), tabBarIcon: ({ color, size }) => <PackageSearch color={color} size={size} /> }} />
        <Tab.Screen name="Ledger" component={LedgerScreen} options={{ tabBarLabel: t('Ledger'), tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
        <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarLabel: t('Reports'), tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />

        {/* Hidden from bottom tab, but accessible from drawer */}
        <Tab.Screen name="Purchase Entry" component={PurchaseScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Purchase History" component={PurchaseHistoryScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Enquiries" component={EnquiriesScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Warehouses" component={WarehousesScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Assets" component={AssetsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Import" component={ImportScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      </Tab.Navigator>
      
      {/* Global Sidebar Overlay */}
      <CustomSidebar />
    </View>
  );
}

function RootComponent() {
  const { state } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Animation values for Splash Screen
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true })
    ]).start();

    async function checkAuth() {
      try {
        const auth = await AsyncStorage.getItem('cs_auth_session');
        if (auth === 'true') setIsAuthenticated(true);
      } catch (e) {
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  if (state.loading || checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
          <Text style={{ fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1, marginBottom: 10, textAlign: 'center' }}>
            COSMO{'\n'}<Text style={{ color: '#3B82F6' }}>STORE</Text>
          </Text>
          <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 40 }}>
            Billing & Inventory
          </Text>
          <ActivityIndicator size="large" color="#3B82F6" />
        </Animated.View>
      </View>
    );
  }

  if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;

  const LightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      border: '#E2E8F0',
      notification: '#EF4444',
    },
  };

  return (
    <NavigationContainer theme={LightTheme}>
      <TabNavigator />
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

const styles = StyleSheet.create({
  modalContainer: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
  },
  langBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5,
    backgroundColor: '#FFFFFF', borderColor: '#CBD5E1',
  },
  langBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  langText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  langTextActive: { color: '#FFF' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  drawerItemText: { fontSize: 16, fontWeight: '600', color: '#334155', marginLeft: 16 },
});
