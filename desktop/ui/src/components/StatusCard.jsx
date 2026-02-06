import React from 'react';

export default function StatusCard({ label, value }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
