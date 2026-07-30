import { FileText } from 'lucide-react';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function TrialBalance({ fin }) {
  return (
    <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <FileText size={20} color="#0F172A" />
        <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>Trial Balance Summary</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
            <th style={{ padding: '12px', textAlign: 'left', color: '#475569' }}>Particulars</th>
            <th style={{ padding: '12px', textAlign: 'right', color: '#475569' }}>Debit (Dr)</th>
            <th style={{ padding: '12px', textAlign: 'right', color: '#475569' }}>Credit (Cr)</th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px', color: '#1E293B' }}>{row.label}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#10B981' }}>{row.dr > 0 ? fmt(row.dr) : '-'}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#EF4444' }}>{row.cr > 0 ? fmt(row.cr) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #CBD5E1', fontWeight: 'bold' }}>
            <td style={{ padding: '16px 12px', color: '#0F172A' }}>Total</td>
            <td style={{ padding: '16px 12px', textAlign: 'right', color: '#10B981' }}>{fmt(fin.totalDr)}</td>
            <td style={{ padding: '16px 12px', textAlign: 'right', color: '#EF4444' }}>{fmt(fin.totalCr)}</td>
          </tr>
        </tfoot>
      </table>
      {fin.totalDr !== fin.totalCr && (
         <div style={{ color: '#F59E0B', fontSize: '0.85rem', marginTop: '15px', fontStyle: 'italic', textAlign: 'center' }}>
           Note: The totals may not tally in a simplified single-entry system.
         </div>
      )}
    </div>
  );
}
