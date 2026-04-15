import React from 'react';
import { Flame, Shield, User, LogOut } from 'lucide-react';

export default function Navbar({ user, colors, handleLogout }) {
  return (
    <header style={{ backgroundColor: colors.tangerine }} className="text-white shadow-lg sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Flame className="w-8 h-8 fill-white" />
          <span style={{ fontWeight: 700 }}>SupaMoto Auction 2026</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full border border-white/30 backdrop-blur-sm">
            {user.role === 'admin' ? <Shield className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
            <span className="font-medium">{user.name}</span>
            <span className="text-xs bg-white text-orange-600 px-2 py-0.5 rounded-full font-bold ml-2">
              {user.role === 'admin' ? 'MASTER' : 'BIDDER'}
            </span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-full transition-colors group relative" title="Logout">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </header>
  );
}