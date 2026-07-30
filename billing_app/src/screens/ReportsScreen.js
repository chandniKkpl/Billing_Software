import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { Download, Printer, Calendar, BarChart2, FileText, CreditCard, Eye, Edit2, Trash2, Smartphone, Banknote, TrendingUp, X } from 'lucide-react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNPrint from 'react-native-print';
import { BarChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { generateReceiptHTML } from '../utils/printUtils';
import Receipt from '../components/Receipt';

const screenWidth = Dimensions.get('window').width;

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from, to;
  switch (period) {
    case 'Daily': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    }
    case 'Weekly': {
      const firstDay = now.getDate() - now.getDay();
      from = new Date(now.setDate(firstDay));
      from.setHours(0,0,0,0);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23,59,59,999);
      break;
    }
    case 'Monthly': {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    }
    case 'Yearly': {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    }
    case 'Custom': {
      from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      to = customTo ? new Date(customTo + 'T23:59:59') : null;
      break;
    }
    default:
      from = null; to = null;
  }
  return { from, to };
}

export default function ReportsScreen() {
  const { state, deleteSale, editBill, t } = useApp();
  const navigation = useNavigation();
  const [period, setPeriod] = useState('Monthly');
  const [reportTab, setReportTab] = useState('Sales'); // 'Sales' | 'Trial' | 'Balance'
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().split('T')[0]);
  const [customTo, setCustomTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBill, setSelectedBill] = useState(null);

  const { from, to } = getDateRange(period, customFrom, customTo);

  const filterByDate = (dateStr) => {
    const d = new Date(dateStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filteredSales = useMemo(() => {
    let sales = state.sales?.filter(s => filterByDate(s.date)) || [];
    return sales.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.sales, from, to]);

  // Aggregations
  const totalSalesAmount = filteredSales.reduce((a, s) => a + s.grandTotal, 0);
  const totalBills = filteredSales.length;
  
  const cashSales = filteredSales.filter(s => s.paymentMode === 'Cash');
  const cashSalesAmount = cashSales.reduce((a, s) => a + s.grandTotal, 0);
  const cashBillsCount = cashSales.length;

  const upiSales = filteredSales.filter(s => ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(s.paymentMode));
  const upiSalesAmount = upiSales.reduce((a, s) => a + s.grandTotal, 0);
  const upiBillsCount = upiSales.length;

  const totalGST = totalSalesAmount * 0.15; // Approx

  const cashPercent = totalSalesAmount ? ((cashSalesAmount / totalSalesAmount) * 100).toFixed(1) : 0;
  const upiPercent = totalSalesAmount ? ((upiSalesAmount / totalSalesAmount) * 100).toFixed(1) : 0;

  const dayWiseSalesData = useMemo(() => {
    const dataMap = {};
    filteredSales.forEach(s => {
      const d = new Date(s.date);
      const dayKey = d.toISOString().split('T')[0];
      if (!dataMap[dayKey]) {
        dataMap[dayKey] = { dateStr: dayKey, name: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), total: 0, bills: 0 };
      }
      dataMap[dayKey].total += s.grandTotal;
      dataMap[dayKey].bills += 1;
    });
    return Object.values(dataMap).sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
  }, [filteredSales]);

  // Generate chart labels and data
  const chartLabels = dayWiseSalesData.map(d => d.name);
  const chartValues = dayWiseSalesData.map(d => d.total);
  const hasChartData = chartLabels.length > 0 && chartValues.length > 0;

  const fin = useMemo(() => {
    let customersDrActual = 0, customersCr = 0, vendorsDr = 0, vendorsCr = 0;
    let cashBankDr = 0, cashBankCr = 0, incomeCr = 0, expenseDr = 0, otherDr = 0, otherCr = 0;

    (state.customers || []).forEach(c => {
      if (c.udhaarBalance < 0) customersCr += Math.abs(c.udhaarBalance);
      else customersDrActual += c.udhaarBalance || 0;
    });

    (state.vendors || []).forEach(v => {
      if (v.balance < 0) vendorsCr += Math.abs(v.balance);
      else vendorsDr += v.balance || 0;
    });

    (state.accounts || []).forEach(a => {
      const isNegative = (a.balance || 0) < 0;
      const absBal = Math.abs(a.balance || 0);
      if (['Cash', 'Bank'].includes(a.type)) {
        if (isNegative) cashBankCr += absBal; else cashBankDr += absBal;
      } else if (a.type === 'Income') {
        if (isNegative) incomeCr += absBal; else otherDr += absBal;
      } else if (a.type === 'Expenditure') {
        if (isNegative) otherCr += absBal; else expenseDr += absBal;
      } else {
        if (isNegative) otherCr += absBal; else otherDr += absBal;
      }
    });

    const inventoryVal = (state.products || []).reduce((sum, p) => sum + ((p.stock || 0) * (p.purchasePrice || 0)), 0);
    const fixedAssetsVal = (state.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const salesRevenueCr = (state.sales || []).reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    
    // Estimate COGS based on sales (if purchase price exists)
    const cogsDr = (state.sales || []).reduce((sum, s) => {
      return sum + s.items.reduce((iSum, i) => iSum + ((i.qty || 0) * (state.products?.find(p => p.id === i.id)?.purchasePrice || 0)), 0);
    }, 0);

    const totalDr = customersDrActual + vendorsDr + cashBankDr + expenseDr + otherDr + inventoryVal + fixedAssetsVal + cogsDr;
    const totalCr = customersCr + vendorsCr + cashBankCr + incomeCr + otherCr + salesRevenueCr;

    return {
      customersDr: customersDrActual, customersCr,
      vendorsDr, vendorsCr,
      cashBankDr, cashBankCr,
      incomeCr, expenseDr,
      otherDr, otherCr,
      inventoryVal, fixedAssetsVal,
      salesRevenueCr, cogsDr,
      totalDr, totalCr
    };
  }, [state]);

  const handlePrintPDF = async () => {
    try {
      const html = `
        <html>
        <head>
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { text-align: center; margin: 0; }
            .sub { text-align: center; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
            th { background: #eee; }
          </style>
        </head>
        <body>
          <h1>Sales Report</h1>
          <div class="sub">Period: ${period.toUpperCase()} (${new Date().toLocaleString()})</div>
          
          <h3>Financial Summary</h3>
          <table>
            <tr><td>Total Revenue</td><td>${fmt(totalSalesAmount)} (${totalBills} bills)</td></tr>
            <tr><td>Cash Sales</td><td>${fmt(cashSalesAmount)} (${cashPercent}%)</td></tr>
            <tr><td>UPI Sales</td><td>${fmt(upiSalesAmount)} (${upiPercent}%)</td></tr>
          </table>

          <h3>Sales Transactions</h3>
          <table>
            <tr><th>Date</th><th>Party</th><th>Amount</th><th>Mode</th><th>Items/Unit</th></tr>
            ${filteredSales.map(s => {
              const customer = state.customers?.find(c => c.id === s.customerId);
              return `<tr>
                <td>${new Date(s.date).toLocaleDateString()}</td>
                <td>${customer ? customer.name : 'Walk-in'}</td>
                <td>${fmt(s.grandTotal)}</td>
                <td>${s.paymentMode}</td>
                <td>${s.items.map(i => `${i.name} (${i.qty} ${i.unit||''})`).join(', ')}</td>
              </tr>`;
            }).join('')}
          </table>
          <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px; text-align: center;">Authorized Signatory</div>
        </body>
        </html>
      `;

      const results = await RNHTMLtoPDF.convert({ html, fileName: `SalesReport_${period}`, base64: true });
      await RNPrint.print({ filePath: results.filePath });
    } catch (e) {
      Alert.alert('Error', 'Failed to print PDF: ' + e.message);
    }
  };

  const handleEditBill = (bill) => {
    editBill(bill);
    setSelectedBill(null);
    navigation.navigate('Billing');
  };

  const printSelectedBill = async () => {
    if (!selectedBill) return;
    const html = generateReceiptHTML(selectedBill);
    try { await RNPrint.print({ html }); } catch (e) { Alert.alert('Print Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 15, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 16, height: 16, backgroundColor: '#0F172A', borderRadius: 4 }} />
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>Reports</Text>
        </View>
        <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '500' }}>
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
        {['Sales', 'Trial', 'Balance'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            onPress={() => setReportTab(tab)}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: reportTab === tab ? '#2563EB' : 'transparent' }}
          >
            <Text style={{ fontWeight: '600', color: reportTab === tab ? '#2563EB' : '#64748B' }}>
              {tab === 'Sales' ? 'Sales Report' : tab === 'Trial' ? 'Trial Balance' : 'Balance Sheet'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {reportTab === 'Sales' && (
      <ScrollView style={{ flex: 1, padding: 15 }} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Filter Bar */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: period === p ? '#10B981' : '#F1F5F9',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {p === 'Custom' ? <BarChart2 size={12} color={period === p ? '#fff' : '#64748B'} /> : <Calendar size={12} color={period === p ? '#fff' : '#64748B'} />}
                <Text style={{ color: period === p ? '#fff' : '#475569', fontWeight: '600', fontSize: 13 }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {period === 'Custom' && (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 15 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 8, fontSize: 13, color: '#1E293B' }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={customFrom}
                onChangeText={setCustomFrom}
              />
              <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 12 }}>TO</Text>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 8, fontSize: 13, color: '#1E293B' }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={customTo}
                onChangeText={setCustomTo}
              />
            </View>
          )}

          <TouchableOpacity onPress={handlePrintPDF} style={{ marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6 }}>
            <Printer size={16} color="#0F172A" />
            <Text style={{ color: '#0F172A', fontWeight: '600', fontSize: 13 }}>Print PDF Report</Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FileText size={18} color="#10B981" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>This {period}'s Report</Text>
          </View>
          <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#059669', fontWeight: '700', fontSize: 11 }}>{totalBills} bills</Text>
          </View>
        </View>

        {/* Dashboard Cards Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15, marginBottom: 20 }}>
          
          {/* Total Revenue */}
          <View style={[styles.card, { borderTopColor: '#10B981' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={[styles.cardIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 16 }}>₹</Text>
              </View>
              <View>
                <Text style={styles.cardLabel}>TOTAL REVENUE</Text>
                <Text style={[styles.cardValue, { color: '#0F172A' }]}>{fmt(totalSalesAmount)}</Text>
                <Text style={styles.cardSub}>{totalBills} transactions</Text>
              </View>
            </View>
          </View>

          {/* Cash Sales */}
          <View style={[styles.card, { borderTopColor: '#10B981' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={[styles.cardIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Banknote size={16} color="#059669" />
              </View>
              <View style={{ paddingRight: 35 }}>
                <Text style={styles.cardLabel}>CASH SALES</Text>
                <Text style={[styles.cardValue, { color: '#10B981' }]}>{fmt(cashSalesAmount)}</Text>
                <Text style={styles.cardSub}>{cashBillsCount} bills</Text>
              </View>
              <View style={[styles.percentBadge, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.percentText, { color: '#10B981' }]}>{cashPercent}%</Text>
              </View>
            </View>
          </View>

          {/* UPI Sales */}
          <View style={[styles.card, { borderTopColor: '#6366F1' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={[styles.cardIconBox, { backgroundColor: '#E0E7FF' }]}>
                <Smartphone size={16} color="#4F46E5" />
              </View>
              <View style={{ paddingRight: 35 }}>
                <Text style={styles.cardLabel}>UPI SALES</Text>
                <Text style={[styles.cardValue, { color: '#6366F1' }]}>{fmt(upiSalesAmount)}</Text>
                <Text style={styles.cardSub}>{upiBillsCount} bills</Text>
              </View>
              <View style={[styles.percentBadge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.percentText, { color: '#6366F1' }]}>{upiPercent}%</Text>
              </View>
            </View>
          </View>

          {/* Total GST */}
          <View style={[styles.card, { borderTopColor: '#F59E0B', marginRight: 15 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
                <TrendingUp size={16} color="#D97706" />
              </View>
              <View>
                <Text style={styles.cardLabel}>TOTAL GST</Text>
                <Text style={[styles.cardValue, { color: '#F59E0B' }]}>{fmt(totalGST)}</Text>
                <Text style={styles.cardSub}>Incl. in revenue</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Payment Mode Bifurcation */}
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
            <CreditCard size={16} color="#0F172A" />
            <Text style={styles.sectionTitle}>Payment Mode Bifurcation</Text>
          </View>
          
          <View style={{ height: 20, backgroundColor: '#E2E8F0', borderRadius: 10, flexDirection: 'row', overflow: 'hidden', marginBottom: 15 }}>
            <View style={{ flex: Number(cashPercent) || 0.1, backgroundColor: '#34D399', height: '100%' }} />
            <View style={{ flex: Number(upiPercent) || 0.1, backgroundColor: '#8B5CF6', height: '100%' }} />
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
              <Text style={{ fontSize: 12, color: '#475569' }}>Cash</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }}>{fmt(cashSalesAmount)}</Text>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>({cashPercent}%)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
              <Text style={{ fontSize: 12, color: '#475569' }}>UPI</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }}>{fmt(upiSalesAmount)}</Text>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>({upiPercent}%)</Text>
            </View>
          </View>
        </View>

        {/* Day-wise Sales Chart */}
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
            <BarChart2 size={16} color="#0F172A" />
            <Text style={styles.sectionTitle}>Day-wise Sales</Text>
          </View>
          
          {hasChartData ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{ labels: chartLabels, datasets: [{ data: chartValues }] }}
                width={Math.max(screenWidth - 60, chartLabels.length * 60)} 
                height={220}
                yAxisLabel="₹"
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 8 },
                  barPercentage: 0.6,
                }}
                style={{ marginVertical: 8, borderRadius: 8 }}
                withInnerLines={false}
              />
            </ScrollView>
          ) : (
            <Text style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>No data available for chart.</Text>
          )}
        </View>

        {/* Bill-wise Detail List */}
        <View style={[styles.sectionCard, { paddingHorizontal: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, marginBottom: 15 }}>
            <FileText size={16} color="#0F172A" />
            <Text style={styles.sectionTitle}>Bill-wise Detail</Text>
          </View>
          
          {filteredSales.map(s => {
            const customer = state.customers?.find(c => c.id === s.customerId);
            const isUPI = ['UPI', 'Card', 'RTGS', 'NEFT', 'Cheque'].includes(s.paymentMode);
            const gstApprox = s.grandTotal * 0.15;
            
            return (
              <View key={s.id} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', padding: 15 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>#{s.id.slice(-6)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#10B981' }}>{fmt(s.grandTotal)}</Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: '#1E293B', fontWeight: '500' }}>{customer ? customer.name : 'Walk-in'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isUPI ? '#EEF2FF' : '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 }}>
                    {isUPI ? <Smartphone size={10} color="#4F46E5" /> : <Banknote size={10} color="#059669" />}
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: isUPI ? '#4F46E5' : '#059669' }}>{isUPI ? 'UPI' : 'Cash'}</Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • {new Date(s.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => setSelectedBill(s)} style={{ padding: 4, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}><Eye size={12} color="#64748B" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditBill(s)} style={{ padding: 4, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}><Edit2 size={12} color="#64748B" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSale(s.id)} style={{ padding: 4, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}><Trash2 size={12} color="#EF4444" /></TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })}
          
          {filteredSales.length === 0 && (
            <Text style={{ textAlign: 'center', padding: 20, color: '#94A3B8' }}>No sales found.</Text>
          )}
        </View>

      </ScrollView>
      )}

      {reportTab === 'Trial' && (
        <ScrollView style={{ flex: 1, padding: 15 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
              <FileText size={16} color="#0F172A" />
              <Text style={styles.sectionTitle}>Trial Balance Summary</Text>
            </View>
            <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderColor: '#E2E8F0', paddingBottom: 8, marginBottom: 8 }}>
              <Text style={{ flex: 2, fontWeight: 'bold', color: '#475569' }}>Particulars</Text>
              <Text style={{ flex: 1, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>Debit (Dr)</Text>
              <Text style={{ flex: 1, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>Credit (Cr)</Text>
            </View>

            {[
              { label: 'Customers (Receivables)', dr: fin.customersDr, cr: fin.customersCr },
              { label: 'Vendors (Payables)', dr: fin.vendorsDr, cr: fin.vendorsCr },
              { label: 'Cash & Bank Accounts', dr: fin.cashBankDr, cr: fin.cashBankCr },
              { label: 'Fixed Assets', dr: fin.fixedAssetsVal, cr: 0 },
              { label: 'Inventory (Closing Stock)', dr: fin.inventoryVal, cr: 0 },
              { label: 'Expenses', dr: fin.expenseDr, cr: 0 },
              { label: 'Other Accounts', dr: fin.otherDr, cr: fin.otherCr },
              { label: 'Income', dr: 0, cr: fin.incomeCr },
              { label: 'Sales Revenue', dr: 0, cr: fin.salesRevenueCr },
              { label: 'Cost of Goods Sold (Est.)', dr: fin.cogsDr, cr: 0 },
            ].map((row, idx) => {
              if (row.dr === 0 && row.cr === 0) return null;
              return (
                <View key={idx} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                  <Text style={{ flex: 2, color: '#1E293B' }}>{row.label}</Text>
                  <Text style={{ flex: 1, color: '#10B981', textAlign: 'right' }}>{row.dr > 0 ? fmt(row.dr) : '-'}</Text>
                  <Text style={{ flex: 1, color: '#EF4444', textAlign: 'right' }}>{row.cr > 0 ? fmt(row.cr) : '-'}</Text>
                </View>
              );
            })}
            
            <View style={{ flexDirection: 'row', paddingVertical: 12, marginTop: 8, borderTopWidth: 2, borderColor: '#CBD5E1' }}>
              <Text style={{ flex: 2, fontWeight: 'bold', color: '#0F172A' }}>Total</Text>
              <Text style={{ flex: 1, fontWeight: 'bold', color: '#10B981', textAlign: 'right' }}>{fmt(fin.totalDr)}</Text>
              <Text style={{ flex: 1, fontWeight: 'bold', color: '#EF4444', textAlign: 'right' }}>{fmt(fin.totalCr)}</Text>
            </View>
            {fin.totalDr !== fin.totalCr && (
               <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 10, fontStyle: 'italic', textAlign: 'center' }}>
                 Note: The totals may not tally in a single-entry system.
               </Text>
            )}
          </View>
        </ScrollView>
      )}

      {reportTab === 'Balance' && (
        <ScrollView style={{ flex: 1, padding: 15 }} contentContainerStyle={{ paddingBottom: 40 }}>
          
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
              <Banknote size={16} color="#059669" />
              <Text style={styles.sectionTitle}>Assets (What you own)</Text>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Fixed Assets</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.fixedAssetsVal)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Inventory (Stock)</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.inventoryVal)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Customers (Receivables)</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.customersDr)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Cash & Bank Balance</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.cashBankDr)}</Text></View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontWeight: 'bold', color: '#059669', fontSize: 16 }}>Total Assets</Text>
              <Text style={{ fontWeight: 'bold', color: '#059669', fontSize: 16 }}>{fmt(fin.fixedAssetsVal + fin.inventoryVal + fin.customersDr + fin.cashBankDr)}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
              <TrendingUp size={16} color="#EF4444" />
              <Text style={styles.sectionTitle}>Liabilities (What you owe)</Text>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Vendors (Payables)</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.vendorsCr)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Customer Advances</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.customersCr)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#475569' }}>Other Credit Balances</Text><Text style={{ color: '#0F172A', fontWeight: '500' }}>{fmt(fin.otherCr + fin.cashBankCr)}</Text></View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontWeight: 'bold', color: '#EF4444', fontSize: 16 }}>Total Liabilities</Text>
              <Text style={{ fontWeight: 'bold', color: '#EF4444', fontSize: 16 }}>{fmt(fin.vendorsCr + fin.customersCr + fin.otherCr + fin.cashBankCr)}</Text>
            </View>
          </View>

        </ScrollView>
      )}

      {/* Bill Details Modal */}
      <Modal visible={!!selectedBill} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedBill(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>Bill Details</Text>
            <TouchableOpacity onPress={() => setSelectedBill(null)} style={{ padding: 6, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          {selectedBill && (
            <ScrollView style={{ padding: 15 }} contentContainerStyle={{ paddingBottom: 40, alignItems: 'center' }}>
              <Receipt sale={selectedBill} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }} onPress={printSelectedBill}>
                  <Printer size={18} color="#2563EB" />
                  <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 14 }}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0' }} onPress={() => handleEditBill(selectedBill)}>
                  <Edit2 size={18} color="#059669" />
                  <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 14 }}>Edit Bill</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', borderTopWidth: 4, minWidth: 220 },
  cardIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  cardSub: { fontSize: 11, color: '#94A3B8' },
  percentBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  percentText: { fontSize: 10, fontWeight: 'bold' },
  sectionCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' }
});
