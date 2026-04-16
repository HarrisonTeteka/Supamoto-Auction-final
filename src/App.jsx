import React, { useState, useEffect, lazy, Suspense } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { 
  Flame, User, Trophy, Shield, Lock, Search, Plus, Edit2, 
  XCircle, Tag, ImagePlus, ChevronLeft, ChevronRight, MonitorSmartphone, AlertTriangle 
} from 'lucide-react';

import Navbar from './components/Navbar';
import AlertToast from './components/AlertToast';
import AuctionCard from './components/AuctionCard';
import bcrypt from 'bcryptjs';


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const AdminPanel = lazy(() => import('./components/AdminPanel'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'supamoto-auction-2026';

export default function App() {
  const colors = { tangerine: '#F58202', mossGreen: '#336021', auburn: '#9E2A2B', cornsilk: '#F9EDCC' };

  // --- State ---
  const [user, setUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loginForm, setLoginForm] = useState({ name: '', password: '', isAdmin: false });
  const [bidInputs, setBidInputs] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedImage, setExpandedImage] = useState(null);
  const [appSettings, setAppSettings] = useState({ loginBg: null });
  const [bgPreview, setBgPreview] = useState(null);
  const [categories, setCategories] = useState(['Cookstoves', 'Fuel', 'Solar', 'General']);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItem, setNewItem] = useState({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' });
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePreview2, setImagePreview2] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- Timer Helper ---
  const calculateTimeLeft = (target) => {
    if (!target) return null;
    const difference = target - Date.now();
    if (difference <= 0) return "AUCTION CLOSED";
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const mins = Math.floor((difference / 1000 / 60) % 60);
    const secs = Math.floor((difference / 1000) % 60);
    return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Loads on app start — items + settings only
useEffect(() => {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  const initAuth = async () => { try { await signInAnonymously(auth); } catch(e){} };
  initAuth();

  const unsubItems = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'items'), (snap) => {
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
  });
  const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), (snap) => {
    if (snap.exists()) setAppSettings(snap.data());
  });

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => {
    setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  return () => { document.head.removeChild(link); unsubItems(); unsubSettings(); unsubUsers(); };
}, []);

// Loads ONLY after a user logs in
// Loads ONLY after a user logs in (categories only)
useEffect(() => {
  if (!user) return;

  const unsubCat = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), (snap) => {
    const cats = snap.docs.map(d => d.data().name);
    if (cats.length > 0) setCategories(cats);
  });

  return () => { unsubCat(); };
}, [user]);

  // --- Timer Tick ---
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(appSettings?.auctionEnd));
    }, 1000);
    return () => clearInterval(timer);
  }, [appSettings?.auctionEnd]);

  // --- Handlers ---
  const showAlert = (message, type = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const enteredName = loginForm.name.trim();
    const enteredPassword = loginForm.password.trim();
    if (!enteredName || !enteredPassword) 
      setIsLoggingIn(false);
      return showAlert("Please enter both name and password.", "error");
    const existingUser = dbUsers.find(u => u.name.toLowerCase() === enteredName.toLowerCase());
    if (existingUser) {
      const passwordMatch = await bcrypt.compare(enteredPassword, existingUser.password);
if (passwordMatch) {
        setUser({ name: existingUser.name, role: existingUser.role });
        showAlert(`Welcome ${existingUser.role === 'admin' ? 'Master' : 'back'}!`, "success");
      } else { showAlert("Incorrect password.", "error"); }
    } else {
      if (loginForm.isAdmin) { showAlert("Admin account not found.", "error"); } 
      else { setPendingUser({ name: enteredName, password: enteredPassword }); setShowTerms(true); }
    }
  };

  const completeRegistration = async () => {
  if (!termsAccepted || !pendingUser) return;
  try {
    const hashedPassword = await bcrypt.hash(pendingUser.password, 6);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), { name: pendingUser.name, password: hashedPassword, role: 'user', createdAt: Date.now() });

      setUser({ name: pendingUser.name, role: 'user' });
      showAlert(`Account created.`, "success");
      setShowTerms(false); setTermsAccepted(false); setPendingUser(null);
    } catch (err) { showAlert("Error creating account.", "error"); }
  };

  const placeBid = async (item) => {
    const amt = parseFloat(bidInputs[item.id]);
    if (isNaN(amt) || amt < (item.currentBid === 0 ? item.startPrice : item.currentBid + 1)) return showAlert("Invalid bid amount.", "error");
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id), {
        currentBid: amt, topBidder: user.name, bids: [...(item.bids || []), { bidder: user.name, amount: amt, timestamp: Date.now() }]
      });
      setBidInputs(prev => ({ ...prev, [item.id]: '' }));
      showAlert(`Bid of K${amt} placed!`, "success");
    } catch (err) { showAlert("Failed to connect.", "error"); }
  };

  const handleAddOrUpdateItem = async (e) => {
    e.preventDefault();
    try {
      const data = { ...newItem, startPrice: parseFloat(newItem.startPrice), faultDescription: newItem.isFaulty ? newItem.faultDescription : '' };
      if (editingItemId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', editingItemId), data); showAlert("Item updated!", "success"); } 
      else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), { ...data, currentBid: 0, topBidder: null, status: "open", bids: [], createdAt: Date.now() }); showAlert("Item added!", "success"); }
      setNewItem({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' });
      setImagePreview(null); setImagePreview2(null); setEditingItemId(null);
    } catch (err) { showAlert("Failed to save item.", "error"); }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file || file.size > 200 * 1024) return showAlert("Image too large (max 200KB).", "error");
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewItem(prev => ({ ...prev, [field]: reader.result }));
      if (field === 'image') setImagePreview(reader.result);
      if (field === 'image2') setImagePreview2(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 500 * 1024) return showAlert("Background max 500KB.", "error");
    const reader = new FileReader();
    reader.onloadend = () => setBgPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const saveBgImage = async () => {
    if (!bgPreview) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), { loginBg: bgPreview }, { merge: true });
    showAlert("Background updated!", "success"); setBgPreview(null);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name: trimmed });
    setNewItem({ ...newItem, category: trimmed }); setNewCategoryName(''); setShowCategoryForm(false); showAlert("Category created!", "success");
  };

const deleteItem = async (id) => {
  const item = items.find(i => i.id === id);
  if (window.confirm(`Are you sure you want to permanently delete "${item?.name || 'this item'}"? This cannot be undone.`)) {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', id));
    showAlert("Item deleted.", "info");
  }
};


  const closeAuction = async (item) => {
  const topBidder = item.topBidder ? ` Winner will be: ${item.topBidder} (K${item.currentBid}).` : ' No bids placed yet.';
  if (window.confirm(`Close auction for "${item.name}"?${topBidder} This cannot be undone.`)) {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id), { status: 'closed' });
    showAlert("Auction closed successfully.", "info");
  }
};


  const scrollCarousel = (direction, categoryName) => {
    const container = document.getElementById(`carousel-${categoryName.replace(/\s+/g, '-')}`);
    if (container) container.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  // ==========================================
  // LOGIN VIEW (RESTORED ORIGINAL STYLE)
  // ==========================================
  if (!user) {
    const loginBgStyle = appSettings?.loginBg ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url(${appSettings.loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: colors.cornsilk };
    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", ...loginBgStyle }} className="min-h-screen flex items-center justify-center p-6 text-[#336021]">
        <AlertToast alerts={alerts} colors={colors} />
        
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border-t-8 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ borderColor: colors.mossGreen }}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><AlertTriangle className="text-orange-500" /> Terms of Auction</h2>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 mb-5">
                <p className="text-sm font-medium leading-relaxed" style={{ color: colors.mossGreen }}>
                  These terms have been established by management. By proceeding, you acknowledge that all actions and decisions are your responsibility, including any resulting payroll deductions and penalties.
                </p>
              </div>
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer mb-6 border border-gray-200 hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 text-orange-500 rounded cursor-pointer" />
                <span className="text-sm font-semibold text-gray-700">Please check the box to confirm your acknowledgment.</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => { setShowTerms(false); setPendingUser(null); }} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={completeRegistration} disabled={!termsAccepted} style={{ backgroundColor: colors.tangerine }} className={`flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-sm ${!termsAccepted ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:shadow-md'}`}>Confirm & Join</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border-t-8" style={{ borderColor: colors.tangerine }}>
          <div className="flex justify-center mb-6"><div style={{ backgroundColor: colors.mossGreen }} className="p-4 rounded-full shadow-md"><Flame className="w-12 h-12 text-white fill-white" /></div></div>
          <h1 className="text-2xl font-bold text-center mb-2" style={{ color: colors.mossGreen }}>SupaMoto Auction 2026</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Chinja Malasha. Chinja Umoyo.</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Display Name</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" required value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} placeholder="Enter your name" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:border-transparent transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder={loginForm.isAdmin ? "Enter admin password" : "Create or enter password"} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:border-transparent transition-all" />
              </div>
              <p className="text-xs text-gray-400 mt-1 pl-1">{!loginForm.isAdmin && "If new, this sets your account password."}</p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer border border-gray-200 hover:bg-gray-100 transition-colors" onClick={() => setLoginForm({...loginForm, isAdmin: !loginForm.isAdmin})}>
              <input type="checkbox" checked={loginForm.isAdmin} onChange={() => {}} className="w-4 h-4 text-orange-500 rounded cursor-pointer" />
              <label className="text-sm font-medium flex items-center gap-2 text-gray-700 cursor-pointer"><Shield className="w-4 h-4 text-gray-500" /> I am a Bidder Master (Admin)</label>
            </div>
            <button type="submit" style={{ backgroundColor: colors.tangerine }} className="w-full text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition-opacity mt-4" disabled={isLoggingIn} >{isLoggingIn ? 'Logging in…' : 'Login'}</button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN APP VIEW
  // ==========================================
  const filteredItems = items.filter(i => (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.desc && i.desc.toLowerCase().includes(searchQuery.toLowerCase()))) && (selectedCategory === 'All' || i.category === selectedCategory));
  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc;
  }, {});

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: colors.cornsilk }} className="min-h-screen text-[#336021] pb-12 overflow-x-hidden">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      
      <Navbar user={user} colors={colors} handleLogout={() => { setUser(null); setLoginForm({ name: '', password: '', isAdmin: false }); }} />
      <AlertToast alerts={alerts} colors={colors} />

      <main className="max-w-6xl mx-auto px-6 mt-8">
        {/* LAZY LOADED ADMIN PANEL WITH ALL PROPS */}
        {user.role === 'admin' && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold animate-pulse">Loading Admin Tools...</div>}>
            <AdminPanel 
      items={items}      // CRITICAL: Must pass this
      dbUsers={dbUsers}  // CRITICAL: Must pass this
      db={db} appId={appId} doc={doc} setDoc={setDoc} showAlert={showAlert}
      colors={colors} appSettings={appSettings} bgPreview={bgPreview} handleBgUpload={handleBgUpload} saveBgImage={saveBgImage}
      editingItemId={editingItemId} setEditingItemId={setEditingItemId}
      showCategoryForm={showCategoryForm} setShowCategoryForm={setShowCategoryForm} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} handleAddCategory={handleAddCategory}
      newItem={newItem} setNewItem={setNewItem} categories={categories} handleAddOrUpdateItem={handleAddOrUpdateItem}
      handleImageUpload={handleImageUpload} imagePreview={imagePreview} imagePreview2={imagePreview2} setImagePreview={setImagePreview} setImagePreview2={setImagePreview2}
    />
          </Suspense>
        )}

        {/* WELCOME MESSAGE WITH TICKING TIMER */}
        {user.role === 'user' && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div style={{ backgroundColor: colors.mossGreen }} className="p-3 rounded-full text-white"><Trophy className="w-8 h-8" /></div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: colors.mossGreen }}>Welcome to the Auction, {user.name}!</h2>
                <p className="text-gray-600 text-sm">Place your highest bids before time runs out.</p>
              </div>
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 px-6 py-3 rounded-2xl text-center min-w-[160px]">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Time Remaining</p>
              <p className="text-2xl font-mono font-black text-orange-700">{timeLeft || "00h 00m 00s"}</p>
            </div>
          </div>
        )}

        {/* SEARCH & FILTER */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="relative flex-grow">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search auction items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-colors" />
          </div>
          <div className="w-full md:w-64">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-colors bg-white font-medium text-gray-700">
              <option value="All">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {/* AUCTION CAROUSELS */}
        {Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(groupedItems).map(([category, catItems]) => (
              <div key={category} className="flex flex-col">
                <div className="flex justify-between items-end mb-4 px-1">
                  <h3 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.mossGreen }}><Tag className="w-6 h-6" style={{ color: colors.tangerine }} /> {category} <span className="text-sm font-normal text-gray-500 ml-2">({catItems.length})</span></h3>
                  <div className="hidden md:flex gap-2">
                    <button onClick={() => scrollCarousel('left', category)} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => scrollCarousel('right', category)} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                <div id={`carousel-${category.replace(/\s+/g, '-')}`} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 pt-2 hide-scroll px-1">
                  {catItems.map(item => (
                    <AuctionCard 
                      key={item.id} item={item} colors={colors} user={user} 
                      bidInput={bidInputs[item.id]} onBidChange={(id, val) => setBidInputs(prev => ({...prev, [id]: val}))}
                      onPlaceBid={placeBid} onStartEdit={(i) => {
                        setNewItem({ name: i.name, desc: i.desc, startPrice: i.startPrice, category: i.category || categories[0], image: i.image || null, image2: i.image2 || null, isFaulty: i.isFaulty || false, faultDescription: i.faultDescription || '' });
                        setImagePreview(i.image || null); setImagePreview2(i.image2 || null); setEditingItemId(i.id); window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onDelete={deleteItem} onClose={closeAuction} onExpandImage={setExpandedImage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-16 bg-white rounded-xl shadow-sm border border-gray-200"><Flame className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-xl font-medium" style={{ color: colors.mossGreen }}>{items.length === 0 ? "No items on the auction block yet." : "No items match your search or filter."}</p></div>
        )}
      </main>

      {/* FULLSCREEN IMAGE MODAL */}
      {expandedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-5xl max-h-full flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <button onClick={() => setExpandedImage(null)} className="absolute -top-12 right-0 text-white hover:text-orange-400 transition-colors"><XCircle className="w-10 h-10" /></button>
            <img src={expandedImage} alt="Expanded view" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}