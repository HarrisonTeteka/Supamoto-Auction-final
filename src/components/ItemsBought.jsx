import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function ItemsBought({ items, user, colors }) {
  const boughtItems = items.filter(item =>
    item.type === 'shop' &&
    (item.purchases || []).some(p => p.buyer === user.name)
  );

  if (boughtItems.length === 0) return null;

  const total = boughtItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: colors.mossGreen }}>
        <ShoppingBag className="w-5 h-5" style={{ color: colors.tangerine }} />
        Your Reserved Items
      </h2>
      <div className="divide-y divide-gray-100">
        {boughtItems.map(item => {
          const purchase = (item.purchases || []).find(p => p.buyer === user.name);
          return (
            <div key={item.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {item.image && (
                  <img src={item.image} alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                )}
                <div>
                  <p className="font-semibold text-sm" style={{ color: colors.mossGreen }}>{item.name}</p>
                  <p className="text-xs text-gray-400">{new Date(purchase?.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-base" style={{ color: colors.tangerine }}>
                  K{Number(item.price || 0).toLocaleString()}
                </p>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  Reserved ✅
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <span className="text-sm text-gray-500 font-medium">Total Reserved</span>
        <span className="font-black text-lg" style={{ color: colors.mossGreen }}>
          K{total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
