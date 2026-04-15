import React from 'react';
import { XCircle, CheckCircle, AlertCircle } from 'lucide-react';

export default function AlertToast({ alerts, colors }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="fixed top-24 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {alerts.map(alert => (
        <div key={alert.id} 
             style={{ backgroundColor: alert.type === 'error' ? colors.auburn : alert.type === 'success' ? colors.mossGreen : colors.tangerine }}
             className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all transform duration-300 animate-in slide-in-from-right`}>
          {alert.type === 'error' ? <XCircle className="w-5 h-5 shrink-0"/> : alert.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0"/> : <AlertCircle className="w-5 h-5 shrink-0"/>}
          {alert.message}
        </div>
      ))}
    </div>
  );
}