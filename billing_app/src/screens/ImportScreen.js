import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import * as XLSX from 'xlsx';
import { useApp } from '../store/AppContext';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const EXPECTED_COLS = ['Product Name', 'Barcode', 'Category', 'Brand', 'Purchased From', 'MRP', 'Selling Price', 'Purchase Price', 'Quantity', 'GST'];

function mapRow(row) {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name: row['Product Name'] || row['Name'] || row['name'] || '',
    barcode: String(row['Barcode'] || row['barcode'] || ''),
    category: row['Category'] || row['category'] || 'Other',
    brand: row['Brand'] || row['brand'] || '',
    purchasedFrom: row['Purchased From'] || row['Supplier'] || '',
    mrp: parseFloat(row['MRP'] || row['mrp'] || 0),
    sellingPrice: parseFloat(row['Selling Price'] || row['sellingPrice'] || row['SP'] || 0),
    purchasePrice: parseFloat(row['Purchase Price'] || row['purchasePrice'] || row['PP'] || 0),
    stock: parseInt(row['Quantity'] || row['Stock'] || row['qty'] || row['Quantity (Optional)'] || 0),
    gst: parseInt(row['GST'] || row['gst'] || 18),
  };
}

export default function ImportScreen() {
  const navigation = useNavigation();
  const { bulkAddProducts, t } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const processFile = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.csv, DocumentPicker.types.xls, DocumentPicker.types.xlsx, DocumentPicker.types.plainText],
      });

      setIsProcessing(true);
      setResult(null);

      const response = await fetch(res.uri);
      const ext = res.name.split('.').pop().toLowerCase();
      let rows = [];
      
      if (ext === 'csv') {
         const content = await response.text();
         
         if (content.startsWith('H,')) {
           const lines = content.split('\n');
           lines.forEach(line => {
             const parts = line.split(',');
             if (parts[0] === 'T') {
               const qty = parseInt(parts[15]) || 0;
               const purchasePrice = parseFloat(parts[11]) || 0;
               const mrp = parseFloat(parts[12]) || 0;
               rows.push({
                 id: Date.now().toString() + Math.random().toString(36).slice(2),
                 name: (parts[5] || '').trim(),
                 barcode: (parts[3] || '').trim(),
                 category: 'Other',
                 brand: (parts[7] || '').trim(),
                 purchasedFrom: (parts[2] || '').trim(),
                 mrp,
                 sellingPrice: mrp,
                 purchasePrice,
                 stock: qty,
                 gst: 12
               });
             }
           });
         } 
         else if (content.toLowerCase().includes('billno') && content.toLowerCase().includes('qnty')) {
             const wb = XLSX.read(content, { type: 'binary' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
             rows = data.map(row => ({
               id: Date.now().toString() + Math.random().toString(36).slice(2),
               name: (row['itemdescription'] || row['name'] || '').toString().trim(),
               barcode: (row['itemcode'] || row['upc'] || '').toString().trim(),
               category: 'Other',
               brand: (row['companyname'] || row['manf'] || '').toString().trim(),
               purchasedFrom: (row['companyname'] || '').toString().trim(),
               mrp: parseFloat(row['mrp']) || 0,
               sellingPrice: parseFloat(row['mrp']) || parseFloat(row['rate']) || 0,
               purchasePrice: parseFloat(row['rate']) || 0,
               stock: parseInt(row['qnty']) || parseInt(row['quantity']) || 0,
               gst: parseFloat(row['sgstper'] ? row['sgstper'] * 2 : 12) || 12,
             })).filter(r => r.name);
         }
         else {
             const wb = XLSX.read(content, { type: 'binary' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
             rows = data.map(mapRow).filter(r => r.name);
         }
      } else {
         const buffer = await response.arrayBuffer();
         const wb = XLSX.read(buffer, { type: 'array' });
         const ws = wb.Sheets[wb.SheetNames[0]];
         const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
         rows = data.map(mapRow).filter(r => r.name);
      }
      
      const merged = {};
      rows.forEach(r => {
        const key = r.barcode || r.name;
        if (merged[key]) {
          merged[key].stock += r.stock;
        } else {
          merged[key] = { ...r };
        }
      });
      rows = Object.values(merged).filter(r => r.name);
      
      const errors = rows.filter(r => !r.sellingPrice || r.sellingPrice <= 0);
      setResult({ rows, errors, total: rows.length });
      
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
         Alert.alert('Error', 'Failed to process file: ' + err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!result?.rows?.length) return;
    try {
      await bulkAddProducts(result.rows);
      Alert.alert('Success', `${result.rows.length} products imported!`);
      setResult(null);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Import failed: ' + err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('Import Products')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.uploadCard}>
          <FileSpreadsheet size={48} color="#8B5CF6" style={{ marginBottom: 16 }} />
          <Text style={styles.uploadTitle}>{t('Upload CSV or Excel File')}</Text>
          <Text style={styles.uploadSubtitle}>{t('Supports Marg ERP, Aryan Wellness, and standard formats.')}</Text>
          
          <TouchableOpacity 
            style={[styles.uploadButton, isProcessing && { opacity: 0.7 }]} 
            onPress={processFile}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Upload size={20} color="#FFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.uploadButtonText}>
              {isProcessing ? t('Processing...') : t('Select File')}
            </Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{t('Import Data')}</Text>
            
            <View style={styles.statRow}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.statText}>{t('Valid Products to Import:')} <Text style={styles.boldText}>{result.rows.length - result.errors.length}</Text></Text>
            </View>

            {result.errors.length > 0 && (
              <View style={styles.statRow}>
                <AlertCircle size={20} color="#EF4444" />
                <Text style={styles.statText}>{t('Items missing Selling Price:')} <Text style={styles.boldText}>{result.errors.length}</Text> {t('(Will be added as 0)')}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.importButton} onPress={handleImport}>
              <Text style={styles.importButtonText}>{t('Confirm & Import')} {result.rows.length} {t('Items')}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.instructionsCard}>
           <Text style={styles.instructionsTitle}>{t('Expected Columns:')}</Text>
           <Text style={styles.instructionsText}>{t('Product Name, Barcode, Category, Brand, Purchased From, MRP, Selling Price, Purchase Price, Quantity, GST')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  content: { padding: 16 },
  uploadCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 16 },
  uploadTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  uploadSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  uploadButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  resultCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 16 },
  resultTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 16 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statText: { fontSize: 15, color: '#334155', marginLeft: 12, flex: 1 },
  boldText: { fontWeight: 'bold', color: '#0F172A' },
  importButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  importButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  instructionsCard: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 16 },
  instructionsTitle: { fontSize: 14, fontWeight: 'bold', color: '#4338CA', marginBottom: 8 },
  instructionsText: { fontSize: 13, color: '#4F46E5', lineHeight: 20 }
});
