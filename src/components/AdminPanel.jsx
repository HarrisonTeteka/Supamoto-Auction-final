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
    if (!items.length) return showAlert?.("No items to export", "error");
    
    let csvContent = "Item Name,Category,Winner Name,Final Price (K),Status\n";

    items.forEach(item => {
      const itemName = (item.name || "Unnamed").replace(/,/g, ""); 
      const winner = item.topBidder || "No Bids";
      const price = item.currentBid || 0;
      const status = item.status || "open";
      
      csvContent += `${itemName},${item.category},${winner},${price},${status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SupaMoto_Auction_Winners_${new Date().toLocaleDateString()}.csv`);
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
      {/* --- AUCTION ANALYTICS DASHBOARD --- */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Bidders</p>
          <p className="text-3xl font-black" style={{ color: colors.mossGreen }}>{dbUsers.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Items</p>
          <p className="text-3xl font-black" style={{ color: colors.mossGreen }}>{items.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Revenue (K)</p>
          <p className="text-3xl font-black text-orange-600">
            {items.reduce((sum, i) => sum + (i.currentBid || 0), 0)}
          </p>
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
            <input required type="number" min="1" placeholder="Start Price (K)" value={newItem.startPrice} onChange={e => setNewItem({...newItem, startPrice: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-shadow" />
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
                {editingItemId && <button type="button" onClick={() => { setEditingItemId(null); setNewItem({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' }); setImagePreview(null); setImagePreview2(null); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors flex-1 xl:flex-none"><XCircle className="w-5 h-5 mx-auto" /></button>}
              </div>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}