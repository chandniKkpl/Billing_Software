import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';

const MonoText = ({ style, ...props }) => (
  <Text style={[{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#000', fontSize: 11 }, style]} {...props} />
);

const DashedLine = () => (
  <View style={{ borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#000', marginVertical: 8, height: 1 }} />
);
const ThickLine = () => (
  <View style={{ borderBottomWidth: 2, borderColor: '#000', marginVertical: 4, height: 2 }} />
);

export default function Receipt({ sale }) {
  if (!sale) return null;
  const dateObj = new Date(sale.date);
  const dateStr = dateObj.toLocaleDateString('en-GB');
  const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const billNo = `#${sale.id.slice(-6).toUpperCase()}`;

  return (
    <View style={styles.container}>
      <MonoText style={styles.header}>Well Pharmacy</MonoText>
      <MonoText style={styles.centerText}>Shop No 1. Grover Market, Near azad chowk, Rewari 123401</MonoText>
      <MonoText style={styles.centerText}>Mob no- 7015167948.</MonoText>
      
      <DashedLine />
      
      <View style={styles.row}>
        <MonoText><MonoText style={styles.bold}>Bill: </MonoText>{billNo}</MonoText>
        <MonoText>{dateStr}</MonoText>
      </View>
      <MonoText><MonoText style={styles.bold}>Time: </MonoText>{timeStr}</MonoText>
      <MonoText><MonoText style={styles.bold}>Mode: </MonoText>{sale.paymentMode}</MonoText>
      
      <DashedLine />
      
      <View style={styles.tableHeader}>
        <MonoText style={[styles.bold, {flex: 2}]}>ITEM</MonoText>
        <MonoText style={[styles.bold, {flex: 1, textAlign: 'center'}]}>MRP</MonoText>
        <MonoText style={[styles.bold, {flex: 1, textAlign: 'center'}]}>RATE</MonoText>
        <MonoText style={[styles.bold, {flex: 0.8, textAlign: 'center'}]}>QTY</MonoText>
        <MonoText style={[styles.bold, {flex: 1, textAlign: 'center'}]}>SAVE</MonoText>
        <MonoText style={[styles.bold, {flex: 1.2, textAlign: 'right'}]}>AMT</MonoText>
      </View>
      
      <DashedLine />
      
      {sale.items.map((item, idx) => {
        const rate = item.sellingPrice.toFixed(2);
        const amt = (item.qty * item.sellingPrice).toFixed(2);
        const mrpStr = item.mrp ? `₹${item.mrp.toFixed(2)}` : '';
        const saveStr = (item.mrp && item.mrp > item.sellingPrice) ? (item.mrp - item.sellingPrice).toFixed(2) : '-';
        return (
          <View key={idx} style={{marginBottom: 4}}>
            <View style={styles.tableRow}>
              <MonoText style={[styles.bold, {flex: 2}]}>{item.name}</MonoText>
              <MonoText style={[{flex: 1, textAlign: 'center', textDecorationLine: 'line-through', color: '#555'}]}>{mrpStr}</MonoText>
              <MonoText style={[{flex: 1, textAlign: 'center'}]}>₹{rate}</MonoText>
              <MonoText style={[{flex: 0.8, textAlign: 'center'}]}>{item.qty}</MonoText>
              <MonoText style={[{flex: 1, textAlign: 'center'}]}>{saveStr}</MonoText>
              <MonoText style={[styles.bold, {flex: 1.2, textAlign: 'right'}]}>₹{amt}</MonoText>
            </View>
            {!!item.barcode && <MonoText style={styles.barcode}>[{item.barcode}]</MonoText>}
          </View>
        );
      })}
      
      <DashedLine />
      
      <View style={styles.row}>
        <MonoText>Subtotal:</MonoText>
        <MonoText>₹{sale.subtotal.toFixed(2)}</MonoText>
      </View>
      <View style={styles.row}>
        <MonoText>GST:</MonoText>
        <MonoText>₹{sale.gst.toFixed(2)}</MonoText>
      </View>
      {sale.discount > 0 && (
        <View style={styles.row}>
          <MonoText>Discount:</MonoText>
          <MonoText>-₹{sale.discount.toFixed(2)}</MonoText>
        </View>
      )}
      
      <ThickLine />
      
      <View style={styles.row}>
        <MonoText style={styles.grandTotal}>GRAND TOTAL:</MonoText>
        <MonoText style={styles.grandTotal}>₹{sale.grandTotal.toFixed(2)}</MonoText>
      </View>
      
      <ThickLine />
      
      <View style={styles.qrContainer}>
        <MonoText style={styles.qrTitle}>📱 SCAN TO PAY</MonoText>
        <Image 
          source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=store@upi&pn=Store&am=${sale.grandTotal.toFixed(2)}` }} 
          style={styles.qrCode} 
        />
        <MonoText style={styles.qrSub}>PhonePe | BHIM UPI | GPay | Paytm</MonoText>
      </View>
      
      <DashedLine />
      
      <MonoText style={styles.footerThanks}>
        Thank you for shopping at Well Pharmacy!{'\n'}*** No Refund / No Exchange ***
      </MonoText>
      
      <DashedLine />
      
      <View style={styles.developer}>
        <MonoText style={{fontSize: 9, color: '#666'}}>Designed & Developed by</MonoText>
        <MonoText style={{fontSize: 10, fontWeight: 'bold', color: '#666'}}>WINTOGETHER Technology</MonoText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 2,
    alignSelf: 'stretch',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  header: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  centerText: {
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  bold: {
    fontWeight: 'bold'
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  barcode: {
    fontSize: 9,
    color: '#777',
    marginTop: 2
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5
  },
  qrTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4
  },
  qrCode: {
    width: 100,
    height: 100,
    marginBottom: 4
  },
  qrSub: {
    fontSize: 8,
    color: '#666'
  },
  footerThanks: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 14,
    marginVertical: 6
  },
  developer: {
    alignItems: 'center',
    marginTop: 8
  }
});
