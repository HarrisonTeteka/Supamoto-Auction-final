import React from 'react';
import { doc, setDoc } from "firebase/firestore";
import {
  MonitorSmartphone, Edit2, Plus, Tag, XCircle,
  Clock, Trophy, Download, Calendar
} from 'lucide-react';

export default function AdminPanel({
  items = [],
  dbUsers = [],
  db, appId, showAlert,
  colors, appSettings, bgPreview, handleBgUpload, saveBgImage,
  editingItemId, setEditingItemId,
  showCategoryForm, setShowCategoryForm, newCategoryName, setNewCategoryName, handleAddCategory,
  newItem, setNewItem, categories, handleAddOrUpdateItem,
  handleImageUpload, imagePreview, imagePreview2, setImagePreview, setImagePreview2,
  auctionStartInput, setAuctionStartInput,
  auctionEndInput, setAuctionEndInput
}) {

  // --- Export Winners CSV ---
  const exportWinnersCSV = () => {
    const winners = items.filter(item => item.status === 'closed' && item.topBidder);
    if (!winners.length) return showAlert?.("No closed auction winners to export yet.", "error");
    let csvContent = "Item Name,Category,Winner Name,Final Price (K),Status\n";
    winners.forEach(item => {
      const itemName = (item.name || "Unnamed").replace(/,/g, "");
      const winner = (item.topBidder || "").replace(/,/g, "");
      const price = item.currentBid || 0;
      const status = item.status || "closed";
      csvContent += `"${itemName}","${item.category}","${winner}",${price},"${status}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SupaMoto_Auction_Winners_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Save Auction Schedule ---
  const saveAuctionSchedule = async (e) => {
    e.preventDefault();
    if (!auctionStartInput || !auctionEndInput) return showAlert?.('Please set both start and end times.', 'error');
    const startTs = new Date(auctionStartInput).getTime();
    const endTs = new Date(auctionEndInput).getTime();
    if (endTs <= startTs) return showAlert?.('End time must be after start time.', 'error');
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');
      await setDoc(settingsRef, { auctionStart: startTs, auctionEnd: endTs }, { merge: true });
      showAlert?.('Auction schedule saved!', 'success');
    } catch (err) {
      showAlert?.('Failed to save schedule.', 'error');
      console.error(err);
    }
  };

  return (
    <>
      {/* --- ANALYTICS KPI ROW --- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Bidders</p>
          <p className="text-3xl font-black" style={{ color: colors.mossGreen }}>{dbUsers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Items Listed</p>
          <p className="text-3xl font-black" style={{ color: colors.mossGreen }}>{items.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Winners</p>
          <p className="text-3xl font-black text-yellow-600">
            {items.filter(i => i.status === 'closed' && i.topBidder).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Revenue (K)</p>
          <p className="text-3xl font-black text-orange-600">
            {items.filter(i => i.status === 'closed').reduce((sum, i) => sum + (i.currentBid || 0), 0).toLocaleString()}
          </p>
        </div>
      </section>

      {/* --- ROW 1: BIDDERS & ITEMS --- */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Bidders Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              👥 Bidders
              <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{dbUsers.length}</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {dbUsers.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No bidders yet</p>
            ) : (
              dbUsers.map((u, idx) => (
                <div key={u.id || idx} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: colors.mossGreen }}>
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.role === 'admin' ? '🔑 Admin' : 'Bidder'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Items Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              📦 Items on Auction
              <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{items.length}</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No items listed yet</p>
            ) : (
              items.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 text-sm">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.category} · Current bid: K{(item.currentBid || 0).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    item.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                  }`}>
                    {item.status === 'closed' ? 'Ended' : 'Live'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- WINNERS TABLE --- */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            🏆 Winners
            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {items.filter(i => i.status === 'closed' && i.topBidder).length}
            </span>
          </h3>
          <button onClick={exportWinnersCSV} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg text-white transition-all" style={{ backgroundColor: colors.mossGreen }}>
            ⬇ Export CSV for HR
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">#</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Winner</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Item Won</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Winning Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.filter(i => i.status === 'closed' && i.topBidder).length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">No auction winners yet</td></tr>
              ) : (
                items.filter(i => i.status === 'closed' && i.topBidder).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: colors.tangerine }}>
                          {item.topBidder?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{item.topBidder}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{item.name}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: colors.mossGreen }}>K{(item.currentBid || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- EXPORT SECTION --- */}
      <section className="bg-white rounded-xl shadow-md p-6 mb-8 border-l-8 border-green-600 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: colors.mossGreen }}>
            <Trophy className="w-5 h-5 text-orange-500" /> HR Winner Reports
          </h2>
          <p className="text-sm text-gray-500">Download the final list for HR payroll processing.</p>
        </div>
        <button onClick={exportWinnersCSV} className="w-full md:w-auto bg-green-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-800 transition-all flex items-center justify-center gap-2 shadow-lg">
          <Download className="w-5 h-5" /> Download CSV for HR
        </button>
      </section>

      {/* --- AUCTION SCHEDULE SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 border-red-500 p-6 mb-8">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1 text-red-600">
          <Clock className="w-5 h-5" /> Auction Schedule
        </h2>
        <p className="text-sm text-gray-500 mb-5">Set the exact start and end date/time for the auction. All users will see a live countdown.</p>
        <form onSubmit={saveAuctionSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Auction Start
            </label>
            <input
              type="datetime-local"
              value={auctionStartInput}
              onChange={e => setAuctionStartInput(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-400 transition-all text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Auction End
            </label>
            <input
              type="datetime-local"
              value={auctionEndInput}
              onChange={e => setAuctionEndInput(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-400 transition-all text-sm"
              required
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="w-full md:w-auto px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> Save Auction Schedule
            </button>
          </div>
        </form>
        {appSettings?.auctionStart && appSettings?.auctionEnd && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            <strong>Current schedule:</strong> {new Date(appSettings.auctionStart).toLocaleString()} → {new Date(appSettings.auctionEnd).toLocaleString()}
          </div>
        )}
      </section>

      {/* --- LOGIN BACKGROUND SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 p-6 mb-8 transition-all" style={{ borderColor: colors.mossGreen }}>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><MonitorSmartphone className="w-5 h-5" /> Login Background</h2>
        <div className="flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex-grow w-full">
            <label className="block text-sm font-medium text-gray-600 mb-2">Upload Background Image (max 500KB)</label>
            <input type="file" accept="image/*" onChange={handleBgUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all cursor-pointer" />
          </div>
          {bgPreview && (
            <div className="flex flex-col items-center gap-2">
              <img src={bgPreview} alt="Preview" className="w-24 h-16 object-cover rounded-lg border-2 border-green-400 shadow-md" />
              <button onClick={saveBgImage} style={{ backgroundColor: colors.mossGreen }} className="text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Save Background</button>
            </div>
          )}
          {appSettings?.loginBg && !bgPreview && (
            <div className="flex flex-col items-center gap-1">
              <img src={appSettings.loginBg} alt="Current" className="w-24 h-16 object-cover rounded-lg border-2 border-gray-300 shadow-sm" />
              <span className="text-xs text-gray-400">Current</span>
            </div>
          )}
        </div>
      </section>

      {/* --- ADD / EDIT ITEM SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 p-6 mb-8" style={{ borderColor: colors.tangerine }}>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6" style={{ color: colors.tangerine }}>
          {editingItemId ? <><Edit2 className="w-5 h-5" /> Edit Item</> : <><Plus className="w-5 h-5" /> Add New Item</>}
        </h2>

        <form onSubmit={handleAddOrUpdateItem} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Item Name *</label>
              <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. SupaMoto Cookstove" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Category *</label>
              <div className="flex gap-2">
                <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm bg-white" required>
                  <option value="">Select category</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button type="button" onClick={() => setShowCategoryForm(!showCategoryForm)} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                  <Tag className="w-4 h-4" />
                </button>
              </div>
              {showCategoryForm && (
                <div className="mt-2 flex gap-2">
                  <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-orange-400" />
                  <button type="button" onClick={handleAddCategory} style={{ backgroundColor: colors.mossGreen }} className="px-4 py-2 text-white text-sm font-bold rounded-lg hover:opacity-90">Add</button>
                  <button type="button" onClick={() => setShowCategoryForm(false)} className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
            <textarea value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} placeholder="Item description..." rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Type</label>
              <select value={newItem.type || 'auction'} onChange={e => setNewItem({...newItem, type: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm bg-white">
                <option value="auction">Auction</option>
                <option value="shop">Shop (Fixed Price)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                {newItem.type === 'shop' ? 'Price (K) *' : 'Starting Bid (K) *'}
              </label>
              <input type="number" required min="0" value={newItem.type === 'shop' ? (newItem.price || '') : newItem.startPrice} onChange={e => newItem.type === 'shop' ? setNewItem({...newItem, price: e.target.value}) : setNewItem({...newItem, startPrice: e.target.value})} placeholder="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm" />
            </div>
            {newItem.type === 'shop' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Stock Quantity *</label>
                <input type="number" required min="1" value={newItem.stock || ''} onChange={e => setNewItem({...newItem, stock: e.target.value})} placeholder="1" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Primary Image (max 200KB)</label>
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'image')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-all cursor-pointer" />
              {imagePreview && (
                <div className="mt-2 relative inline-block">
                  <img src={imagePreview} alt="Preview" className="w-24 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
                  <button type="button" onClick={() => { setImagePreview(null); setNewItem({...newItem, image: null}); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">×</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Secondary Image (max 200KB)</label>
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'image2')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-all cursor-pointer" />
              {imagePreview2 && (
                <div className="mt-2 relative inline-block">
                  <img src={imagePreview2} alt="Preview 2" className="w-24 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
                  <button type="button" onClick={() => { setImagePreview2(null); setNewItem({...newItem, image2: null}); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">×</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer" onClick={() => setNewItem({...newItem, isFaulty: !newItem.isFaulty})}>
            <input type="checkbox" checked={newItem.isFaulty} onChange={() => {}} className="w-4 h-4 cursor-pointer" />
            <label className="text-sm font-medium text-gray-700 cursor-pointer">Mark as Faulty / Needs Repair</label>
          </div>
          {newItem.isFaulty && (
            <textarea value={newItem.faultDescription} onChange={e => setNewItem({...newItem, faultDescription: e.target.value})} placeholder="Describe the fault or repair needed..." rows={2} className="w-full px-4 py-2.5 border border-orange-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 transition-all text-sm resize-none bg-orange-50" />
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" style={{ backgroundColor: colors.tangerine }} className="flex-1 md:flex-none px-8 py-3 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2">
              {editingItemId ? <><Edit2 className="w-4 h-4" /> Update Item</> : <><Plus className="w-4 h-4" /> Add Item</>}
            </button>
            {editingItemId && (
              <button type="button" onClick={() => { setEditingItemId(null); setNewItem({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' }); setImagePreview(null); setImagePreview2(null); }} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
