import React from 'react';
import { doc, setDoc } from "firebase/firestore"; 
import { 
  MonitorSmartphone, ImagePlus, Edit2, Plus, Tag, XCircle, 
  Clock, Trophy, Download 
} from 'lucide-react';

export default function AdminPanel({
  // Added items and dbUsers to the props
  items = [], 
  dbUsers = [], 
  db, appId, showAlert, 
  colors, appSettings, bgPreview, handleBgUpload, saveBgImage,
  editingItemId, setEditingItemId,
  showCategoryForm, setShowCategoryForm, newCategoryName, setNewCategoryName, handleAddCategory,
  newItem, setNewItem, categories, handleAddOrUpdateItem,
  handleImageUpload, imagePreview, imagePreview2, setImagePreview, setImagePreview2
}) {

  // --- Export Logic ---
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
    link.setAttribute("download", `SupaMoto_Auction_Winners_${new Date().toISOString().slice(0, 10)}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Timer Logic ---
  const resetAuctionTimer = async () => {
    try {
      const duration = 1 * 24 * 60 * 60 * 1000; // 24 hours
      const newEndTime = Date.now() + duration;
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');
      await setDoc(settingsRef, { auctionEnd: newEndTime }, { merge: true });
      
      if (showAlert) showAlert("Auction timer reset for 24 hours!", "success");
    } catch (error) {
      if (showAlert) showAlert("Failed to reset timer", "error");
      console.error(error);
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
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 text-sm">
              📦
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
              <p className="text-xs text-gray-400">{item.category} · Current bid: K{(item.currentBid || 0).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
              item.status === 'closed'
                ? 'bg-gray-100 text-gray-500'
                : 'bg-green-100 text-green-700'
            }`}>
              {item.status === 'closed' ? 'Ended' : 'Live'}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
</section>

{/* --- ROW 2: WINNERS TABLE --- */}
<section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
    <h3 className="font-bold text-gray-700 flex items-center gap-2">
      🏆 Winners
      <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
        {items.filter(i => i.status === 'closed' && i.topBidder).length}
      </span>
    </h3>
    <button
      onClick={exportWinnersCSV}
      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg text-white transition-all"
      style={{ backgroundColor: colors.mossGreen }}
    >
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
          <tr>
            <td colSpan={4} className="text-center py-12 text-gray-400">No auction winners yet</td>
          </tr>
        ) : (
          items
            .filter(i => i.status === 'closed' && i.topBidder)
            .map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-gray-400 font-medium">{idx + 1}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: colors.tangerine }}>
                      {item.topBidder?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{item.topBidder}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{item.name}</td>
                <td className="px-5 py-3 font-bold" style={{ color: colors.mossGreen }}>
                  K{(item.currentBid || 0).toLocaleString()}
                </td>
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
        <button 
          onClick={exportWinnersCSV}
          className="w-full md:w-auto bg-green-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-800 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Download className="w-5 h-5" /> Download CSV for HR
        </button>
      </section>

      {/* --- MASTER TIMER SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 p-6 mb-8 transition-all border-red-500">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-red-600">
          <Clock className="w-5 h-5" /> Master Auction Timer
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          This will reset the countdown to exactly 24 hours for all users.
        </p>
        <button 
          onClick={resetAuctionTimer}
          className="w-full md:w-auto px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
        >
          Restart 24-Hour Countdown
        </button>
      </section>

      {/* --- LOGIN BACKGROUND SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 p-6 mb-8 transition-all" style={{ borderColor: colors.mossGreen }}>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><MonitorSmartphone className="w-5 h-5" /> Login Background</h2>
        <div className="flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex-grow w-full md:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload New Background Photo (Max 500KB)</label>
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
              <ImagePlus className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <input type="file" accept="image/*" onChange={handleBgUpload} className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 outline-none w-full" />
            </div>
          </div>
          {bgPreview && (
            <div className="flex items-center gap-4 w-full md:w-auto">
              <img src={bgPreview} alt="Preview" className="w-24 h-16 object-cover rounded shadow-sm border border-gray-200" />
              <button onClick={saveBgImage} style={{ backgroundColor: colors.tangerine }} className="text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity font-semibold whitespace-nowrap">Save</button>
            </div>
          )}
          {appSettings?.loginBg && !bgPreview && (
            <div className="flex items-center gap-3"><span className="text-sm text-gray-500 font-medium">Current:</span><img src={appSettings.loginBg} alt="Current" className="w-16 h-10 object-cover rounded shadow-sm border border-gray-200 opacity-70" /></div>
          )}
        </div>
      </section>

      {/* --- ADD/EDIT ITEM SECTION --- */}
      <section className="bg-white rounded-xl shadow-md border-t-4 p-6 mb-8 transition-all" style={{ borderColor: editingItemId ? colors.tangerine : colors.mossGreen }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: editingItemId ? colors.tangerine : colors.mossGreen }}>{editingItemId ? <Edit2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>} {editingItemId ? 'Edit Item' : 'Add New Item'}</h2>
        </div>
        
        {showCategoryForm && (
          <form onSubmit={handleAddCategory} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-3 items-center">
            <Tag className="w-5 h-5 text-gray-400" />
            <input autoFocus type="text" placeholder="New Category Name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="px-4 py-2 border rounded-lg outline-none flex-grow focus:ring-2 focus:ring-orange-400" />
            <div className="flex gap-2 w-full md:w-auto">
              <button type="submit" style={{ backgroundColor: colors.mossGreen }} className="text-white px-4 py-2 rounded-lg font-medium flex-1 md:flex-none">Save</button>
              <button type="button" onClick={() => setShowCategoryForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium flex-1 md:flex-none hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        )}

        <form onSubmit={handleAddOrUpdateItem} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required type="text" placeholder="Item Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-shadow" />
            <div className="flex gap-2">
              <select required value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-shadow flex-grow bg-white">
                <option value="" disabled>Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setShowCategoryForm(true)} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors" title="Add Category"><Plus className="w-5 h-5"/></button>
            </div>
            <div className="flex flex-col gap-2">
  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
    <button type="button"
      onClick={() => setNewItem(prev => ({ ...prev, type: 'auction', price: '', stock: '' }))}
      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${(newItem.type || 'auction') === 'auction' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
      🔨 Auction
    </button>
    <button type="button"
      onClick={() => setNewItem(prev => ({ ...prev, type: 'shop', startPrice: '' }))}
      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${newItem.type === 'shop' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
      🏪 Shop Item
    </button>
  </div>
  {(newItem.type || 'auction') === 'auction' ? (
    <input required type="number" min="1" placeholder="Start Price (K)"
      value={newItem.startPrice}
      onChange={e => setNewItem({...newItem, startPrice: e.target.value})}
      className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-shadow" />
  ) : (
    <div className="flex gap-2">
      <input required type="number" min="1" placeholder="Fixed Price (K)"
        value={newItem.price || ''}
        onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
        className="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-400 transition-shadow" />
      <input required type="number" min="1" placeholder="Stock"
        value={newItem.stock || ''}
        onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})}
        className="w-24 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-400 transition-shadow" />
    </div>
  )}
</div>
          </div>
          <div className="flex flex-col gap-4">
            <input type="text" placeholder="Short Description" value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 w-full transition-shadow" />
            
            <div className="flex flex-col border border-gray-200 rounded-lg p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 mb-2">
                <input type="checkbox" checked={newItem.isFaulty} onChange={e => setNewItem({...newItem, isFaulty: e.target.checked})} className="w-4 h-4 text-orange-500 rounded cursor-pointer" /> Faulty / Damaged Item
              </label>
              {newItem.isFaulty && <input type="text" placeholder="Specify fault..." value={newItem.faultDescription} onChange={e => setNewItem({...newItem, faultDescription: e.target.value})} className="px-3 py-2 border border-red-300 rounded-md outline-none focus:ring-2 focus:ring-red-400 w-full text-sm bg-white" required={newItem.isFaulty} />}
            </div>

            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-end">
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto flex-grow">
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-gray-50 flex-1">
                  <ImagePlus className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'image')} className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 outline-none w-full" />
                  {imagePreview && <img src={imagePreview} className="w-8 h-8 object-cover rounded shadow-sm ml-auto" />}
                </div>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-gray-50 flex-1">
                  <ImagePlus className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'image2')} className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 outline-none w-full" />
                  {imagePreview2 && <img src={imagePreview2} className="w-8 h-8 object-cover rounded shadow-sm ml-auto" />}
                </div>
              </div>
              <div className="flex gap-2 w-full xl:w-auto">
                <button type="submit" style={{ backgroundColor: editingItemId ? colors.tangerine : colors.mossGreen }} className="text-white px-8 py-2 rounded-lg hover:opacity-90 transition-opacity font-semibold whitespace-nowrap flex-1 xl:flex-none">{editingItemId ? 'Update Item' : 'Add Item'}</button>
                {editingItemId && <button type="button" onClick={() => { setEditingItemId(null); setNewItem({ name: '', desc: '', startPrice: '', price: '', stock: '', type: 'auction', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' }); setImagePreview(null); setImagePreview2(null); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors flex-1 xl:flex-none"><XCircle className="w-5 h-5 mx-auto" /></button>}
              </div>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}