import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { Lock } from 'lucide-react-native';

export default function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const storedPinHash = await AsyncStorage.getItem('cs_auth_pin');
        if (!storedPinHash) {
          setIsSetup(true);
        }
      } catch (e) {
        console.error('Error reading pin from storage', e);
      } finally {
        setLoading(false);
      }
    };
    checkSetup();
  }, []);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError('');
    
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    const hashedPin = CryptoJS.SHA256(pin).toString();

    try {
      if (isSetup) {
        await AsyncStorage.setItem('cs_auth_pin', hashedPin);
        await AsyncStorage.setItem('cs_auth_session', 'true');
        setProcessing(false);
        onLogin();
      } else {
        const storedPinHash = await AsyncStorage.getItem('cs_auth_pin');
        if (hashedPin === storedPinHash) {
          await AsyncStorage.setItem('cs_auth_session', 'true');
          setProcessing(false);
          onLogin();
        } else {
          setError('Incorrect PIN');
          setPin('');
          setProcessing(false);
        }
      }
    } catch (e) {
      setError('An error occurred. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Lock size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{isSetup ? 'Set Security PIN' : 'Enter Security PIN'}</Text>
            <Text style={styles.subtitle}>
              {isSetup ? 'Create a new PIN to secure your billing app.' : 'Please enter your PIN to access Cosmo Store.'}
            </Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                placeholder={isSetup ? 'Enter a 4+ digit PIN' : 'Enter PIN'}
                secureTextEntry
                value={pin}
                onChangeText={text => { 
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setPin(numericValue); 
                  setError(''); 
                }}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <TouchableOpacity 
              style={[styles.button, (processing || pin.length < 4) && styles.buttonDisabled]} 
              onPress={handleSubmit} 
              disabled={processing || pin.length < 4}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{isSetup ? 'Save & Continue' : 'Unlock'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  iconContainer: {
    backgroundColor: '#2563EB',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  error: {
    color: '#EF4444',
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 18,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
