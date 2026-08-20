"use client";
import Reports from '../../views/Reports';
import { Suspense } from 'react';

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading Reports...</div>}>
      <Reports />
    </Suspense>
  );
}
