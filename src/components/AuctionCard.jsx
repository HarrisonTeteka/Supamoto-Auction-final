import React from 'react';
import { Tag, Flame, XCircle, AlertTriangle, Trophy, History, Edit2, Trash2, Clock } from 'lucide-react';

export default function AuctionCard({ item, colors, user, bidInput, onBidChange, onPlaceBid, onStartEdit, onDelete, onClose, onExpandImage }) {
  if (!item) return null;
  const isOpen = item.status === 'open';
  const hasBids = item.currentBid > 0;
  const minBid = hasBids ? item.currentBid + 1 : item.startPrice;

  return (
    <div className={`flex flex-col bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 w-[85vw] sm:w-[350px] lg:w-[400px] shrink-0 snap-start ${!isOpen ? 'opacity-75 grayscale-[0.2]' : 'hover:shadow-xl'}`}>
      <div style={{ backgroundColor: isOpen ? colors.tangerine : '#9ca3af' }} className="h-48 flex items-center justify-center text-white relative overflow-hidden group">
        {item.image || item.image2 ? (
          <div className="w-full h-full flex">
            {item.image && <img src={item.image} alt={item.name} onClick={() => onExpandImage(item.image)} className={`flex-1 h-full object-cover transition-all duration-300 cursor-pointer hover:scale-105 hover:opacity-90 ${!isOpen ? 'opacity-50 grayscale' : ''}`} />}
            {item.image && item.image2 && <div className="w-1 bg-white/30 z-10"></div>}
            {item.image2 && <img src={item.image2} alt={`${item.name} 2`} onClick={() => onExpandImage(item.image2)} className={`flex-1 h-full object-cover transition-all duration-300 cursor-pointer hover:scale-105 hover:opacity-90 ${!isOpen ? 'opacity-50 grayscale' : ''}`} />}
          </div>
        ) : (
          <>
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>
            {isOpen ? <Flame className="w-16 h-16 opacity-40 fill-current" /> : <XCircle className="w-12 h-12 opacity-50" />}
          </>
        )}
      </div>

      <div className="p-5 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs font-semibold tracking-wider uppercase text-gray-500 flex items-center gap-1 mt-1"><Tag className="w-3 h-3" /> {item.category || 'Uncategorized'}</span>
          <span style={{ backgroundColor: isOpen ? '#e8f3e5' : '#f1f5f9', color: isOpen ? colors.mossGreen : '#64748b' }} className="text-xs font-bold px-2 py-1 rounded-full border border-transparent">{isOpen ? 'ACTIVE' : 'CLOSED'}</span>
        </div>
        <h3 style={{ color: colors.mossGreen }} className="text-xl font-bold line-clamp-1 mb-2">{item.name}</h3>
        <p className="text-sm text-gray-600 mb-4 h-12 line-clamp-2">{item.desc || 'No description provided.'}</p>

        {item.isFaulty && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-1.5 text-red-700 font-bold mb-1"><AlertTriangle className="w-4 h-4" /> FAULTY ITEM</div>
            <p className="text-red-600 font-medium">{item.faultDescription}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4">
          <div className="flex justify-between items-center mb-1 text-sm text-gray-500"><span>Starting Price:</span><span className="font-medium text-gray-700">K{item.startPrice}</span></div>
          <div className="flex justify-between items-center"><span className="text-sm font-semibold" style={{ color: colors.mossGreen }}>Current Bid:</span><span style={{ color: hasBids ? colors.tangerine : '#9ca3af' }} className="text-2xl font-bold">{hasBids ? `K${item.currentBid}` : 'No Bids'}</span></div>
          {hasBids && (
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 text-sm">
              <span className="flex items-center text-gray-500"><Trophy className="w-4 h-4 mr-1 text-yellow-500"/> Leader:</span>
              <span className="font-semibold" style={{ color: colors.mossGreen }}>{item.topBidder === user?.name ? 'You! 🎉' : item.topBidder}</span>
            </div>
          )}
          {item.bids && item.bids.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><History className="w-3 h-3" /> Bid History</p>
              <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 hide-scroll">
                {[...item.bids].sort((a, b) => b.amount - a.amount).map((bid, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1.5 px-2 bg-white rounded-md border border-gray-100 shadow-sm">
                    <span className="font-medium text-gray-700">{bid.bidder} {bid.bidder === user?.name ? <span className="text-orange-500 ml-1">(You)</span> : ''}</span>
                    <span className="font-bold" style={{ color: colors.mossGreen }}>K{bid.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          {user?.role === 'user' && isOpen && (
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">K</span>
                <input type="number" placeholder={minBid.toString()} value={bidInput || ''} onChange={(e) => onBidChange(item.id, e.target.value)} className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg outline-none text-sm transition-colors focus:border-orange-400" />
              </div>
              <button onClick={() => onPlaceBid(item)} style={{ backgroundColor: colors.tangerine }} className="text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm hover:opacity-90 transition-opacity">Bid</button>
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="flex flex-col gap-2">
              {isOpen && <button onClick={() => onClose(item)} className="w-full bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"><Clock className="w-3 h-3" /> Close Auction</button>}
              <div className="flex gap-2">
                 <button onClick={() => onStartEdit(item)} className="flex-1 bg-blue-50 text-blue-600 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-blue-100 transition-colors"><Edit2 className="w-3 h-3" /> Edit</button>
                 <button onClick={() => onDelete(item.id)} style={{ color: colors.auburn }} className="flex-1 bg-red-50 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-red-100 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
            </div>
          )}
          {!isOpen && <div className="bg-gray-100 text-center py-2 rounded-lg font-medium text-gray-600 text-xs border border-gray-200">{hasBids ? `Won by ${item.topBidder}` : 'Auction Ended'}</div>}
        </div>
      </div>
    </div>
  );
}