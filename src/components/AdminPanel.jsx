import React from 'react';
import { MonitorSmartphone, ImagePlus, Edit2, Plus, Tag, XCircle } from 'lucide-react';

export default function AdminPanel({
  colors, appSettings, bgPreview, handleBgUpload, saveBgImage,
  editingItemId, setEditingItemId,
  showCategoryForm, setShowCategoryForm, newCategoryName, setNewCategoryName, handleAddCategory,
  newItem, setNewItem, categories, handleAddOrUpdateItem,
  handleImageUpload, imagePreview, imagePreview2, setImagePreview, setImagePreview2
}) {
  return (
    <>
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