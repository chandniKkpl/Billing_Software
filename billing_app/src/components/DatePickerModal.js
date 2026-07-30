import React from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function DatePickerModal({ visible, onClose, onSelectDate, selectedDate }) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={day => {
              onSelectDate(day.dateString); // 'YYYY-MM-DD'
            }}
            markedDates={selectedDate ? { [selectedDate]: { selected: true, selectedColor: '#2563eb' } } : {}}
            theme={{ todayTextColor: '#2563eb', arrowColor: '#2563eb' }}
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  calendarContainer: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cancelBtn: { marginTop: 10, padding: 12, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8 },
  cancelBtnText: { color: '#475569', fontWeight: 'bold' },
});
