import React, { useState, useEffect, lazy, Suspense } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { User, Trophy, Shield, Lock, Search, XCircle, Tag, ChevronLeft, ChevronRight, AlertTriangle, UserPlus } from 'lucide-react';
import logo from './assets/logo.webp';

import Navbar from './components/Navbar';
import AlertToast from './components/AlertToast';
import AuctionCard from './components/AuctionCard';
import ItemsBought from './components/ItemsBought';

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

// --- Web Crypto password hashing (non-blocking) ---
const hashPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return JSON.stringify({ salt: Array.from(salt), hash: Array.from(new Uint8Array(hashBits)) });
};

const verifyPassword = async (password, stored) => {
  try {
    const { salt, hash } = JSON.parse(stored);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const hashBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return JSON.stringify(Array.from(new Uint8Array(hashBits))) === JSON.stringify(hash);
  } catch { return false; }
};

// --- Timer helper (outside component) ---
const calculateTimeLeft = (start, end) => {
  if (!end) return null;
  const now = Date.now();
  if (start && now < start) return 'NOT STARTED';
  const diff = end - now;
  if (diff <= 0) return 'AUCTION CLOSED';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
};

export default function App() {
  const colors = { tangerine: '#F58202', mossGreen: '#336021', auburn: '#9E2A2B', cornsilk: '#F9EDCC' };

  const [user, setUser]                     = useState(null);
  const [dbUsers, setDbUsers]               = useState([]);
  const [items, setItems]                   = useState([]);
  const [alerts, setAlerts]                 = useState([]);
  const [bidInputs, setBidInputs]           = useState({});
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedImage, setExpandedImage]   = useState(null);
  const [appSettings, setAppSettings]       = useState({ loginBg: null });
  const [bgPreview, setBgPreview]           = useState(null);
  const [categories, setCategories]         = useState(['Cookstoves', 'Fuel', 'Solar', 'General']);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName]   = useState('');
  const [newItem, setNewItem]               = useState({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' });
  const [imagePreview, setImagePreview]     = useState(null);
  const [imagePreview2, setImagePreview2]   = useState(null);
  const [editingItemId, setEditingItemId]   = useState(null);
  const [showTerms, setShowTerms]           = useState(false);
  const [termsAccepted, setTermsAccepted]   = useState(false);
  const [pendingUser, setPendingUser]       = useState(null);
  const [timeLeft, setTimeLeft]             = useState('');
  const [auctionStartInput, setAuctionStartInput] = useState('');
  const [auctionEndInput, setAuctionEndInput]     = useState('');

  // Login form state
  const [loginName, setLoginName]           = useState('');
  const [loginPass, setLoginPass]           = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);

  // Register form state
  const [regName, setRegName]               = useState('');
  const [regPass, setRegPass]               = useState('');
  const [regLoading, setRegLoading]         = useState(false);

  // --- App start ---
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    signInAnonymously(auth).catch(() => {});

    const unsubItems    = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'items'), snap =>
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), snap => {
      if (snap.exists()) setAppSettings(snap.data());
    });
    const unsubUsers    = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), snap =>
      setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { document.head.removeChild(link); unsubItems(); unsubSettings(); unsubUsers(); };
  }, []);

  // --- Pre-fill schedule inputs ---
  useEffect(() => {
    const pad = n => String(n).padStart(2, '0');
    const fmt = ts => {
      if (!ts) return '';
      const d = new Date(ts);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setAuctionStartInput(fmt(appSettings?.auctionStart));
    setAuctionEndInput(fmt(appSettings?.auctionEnd));
  }, [appSettings?.auctionStart, appSettings?.auctionEnd]);

  // --- Post-login subscriptions ---
  useEffect(() => {
    if (!user) return;
    const unsubCat = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), snap => {
      const cats = snap.docs.map(d => d.data().name);
      if (cats.length > 0) setCategories(cats);
    });
    const unsubNotifs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), snap => {
      const unread = snap.docs.filter(d => { const n = d.data(); return n.to === user.name && !n.read; });
      if (unread.length === 0) return;
      unread.forEach(d => showAlert(`⚠️ ${d.data().message}`, 'error'));
      Promise.all(unread.map(d => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', d.id), { read: true }))).catch(console.error);
    });
    return () => { unsubCat(); unsubNotifs(); };
  }, [user]);

  // --- Timer ---
  useEffect(() => {
    const tick = () => setTimeLeft(calculateTimeLeft(appSettings?.auctionStart, appSettings?.auctionEnd));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [appSettings?.auctionStart, appSettings?.auctionEnd]);

  const isAuctionClosed = () => appSettings?.auctionEnd && Date.now() >= appSettings.auctionEnd;

  const showAlert = (message, type = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 4000);
  };

  // --- LOGIN (existing users only) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const name = loginName.trim();
    const pass = loginPass.trim();
    if (!name || !pass) return showAlert('Please enter your name and password.', 'error');
    setLoginLoading(true);
    const existing = dbUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      showAlert('Account not found. Please create one below.', 'error');
      setLoginLoading(false);
      return;
    }
    const match = await verifyPassword(pass, existing.password);
    if (match) {
      setUser({ name: existing.name, role: existing.role });
      showAlert(`Welcome back, ${existing.name}! 👋`, 'success');
    } else {
      showAlert('Incorrect password. Please try again.', 'error');
    }
    setLoginLoading(false);
  };

  // --- REGISTER (new users — show T&C first) ---
  const handleRegister = async (e) => {
    e.preventDefault();
    const name = regName.trim();
    const pass = regPass.trim();
    if (!name || !pass) return showAlert('Please fill in all fields.', 'error');
    if (pass.length < 4) return showAlert('Password must be at least 4 characters.', 'error');
    const existing = dbUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return showAlert('That name is already taken. Please choose another.', 'error');
    setPendingUser({ name, password: pass });
    setShowTerms(true);
  };

  const completeRegistration = async () => {
    if (!termsAccepted || !pendingUser) return;
    setRegLoading(true);
    try {
      const hashedPassword = await hashPassword(pendingUser.password);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
        name: pendingUser.name, password: hashedPassword, role: 'user', createdAt: Date.now()
      });
      setUser({ name: pendingUser.name, role: 'user' });
      showAlert(`Account created! Welcome, ${pendingUser.name}! 🎉`, 'success');
      setShowTerms(false); setTermsAccepted(false); setPendingUser(null);
      setRegName(''); setRegPass('');
    } catch {
      showAlert('Error creating account. Please try again.', 'error');
    }
    setRegLoading(false);
  };

  // --- Place Bid ---
  const placeBid = async (item) => {
    if (user?.role !== 'admin' && isAuctionClosed()) return showAlert('The auction has closed. Bidding is locked.', 'error');
    const amt = parseFloat(bidInputs[item.id]);
    if (isNaN(amt) || amt <= 0) return showAlert('Please enter a valid bid amount.', 'error');
    const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(itemRef);
        if (!snap.exists()) throw new Error('Item no longer exists.');
        const live = snap.data();
        if (live.status === 'closed') throw new Error('This auction has already closed.');
        const minBid = live.currentBid === 0 ? live.startPrice : live.currentBid + 1;
        if (amt < minBid) throw new Error(`Bid must be at least K${minBid}.`);
        if (live.topBidder === user.name && live.currentBid === amt) throw new Error('You are already the top bidder!');
        if (live.topBidder && live.topBidder !== user.name) {
          const notifRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'));
          transaction.set(notifRef, {
            to: live.topBidder, message: `You've been outbid on "${live.name}"! New bid: K${amt.toLocaleString()}. Bid higher to stay in the lead.`,
            itemId: item.id, itemName: live.name, newBid: amt, read: false, timestamp: Date.now()
          });
        }
        transaction.update(itemRef, {
          currentBid: amt, topBidder: user.name,
          bids: [...(live.bids || []), { bidder: user.name, amount: amt, timestamp: Date.now() }]
        });
      });
      setBidInputs(prev => ({ ...prev, [item.id]: '' }));
      showAlert(`✅ Bid of K${amt.toLocaleString()} placed!`, 'success');
    } catch (err) { showAlert(err.message || 'Failed to place bid.', 'error'); }
  };

  // --- Buy Shop Item ---
  const buyItem = async (item) => {
    if (!user) return;
    if (user?.role !== 'admin' && isAuctionClosed()) return showAlert('The auction has closed.', 'error');
    const alreadyBought = (item.purchases || []).some(p => p.buyer === user.name);
    if (alreadyBought) return showAlert('You have already reserved this item.', 'error');
    if (item.stock <= 0) return showAlert('Sorry, this item is out of stock.', 'error');
    const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(itemRef);
        if (!snap.exists()) throw new Error('Item no longer exists.');
        const live = snap.data();
        if (live.stock <= 0) throw new Error('Out of stock.');
        if ((live.purchases || []).some(p => p.buyer === user.name)) throw new Error('Already reserved.');
        transaction.update(itemRef, {
          stock: live.stock - 1,
          purchases: [...(live.purchases || []), { buyer: user.name, timestamp: Date.now() }]
        });
      });
      showAlert(`✅ "${item.name}" reserved for K${item.price.toLocaleString()}!`, 'success');
    } catch (err) { showAlert(err.message || 'Purchase failed.', 'error'); }
  };

  // --- Add / Edit Item ---
  const handleAddOrUpdateItem = async (e) => {
    e.preventDefault();
    try {
      const data = { ...newItem, startPrice: parseFloat(newItem.startPrice), faultDescription: newItem.isFaulty ? newItem.faultDescription : '' };
      if (editingItemId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', editingItemId), data);
        showAlert('Item updated!', 'success');
      } else {
        const isShop = newItem.type === 'shop';
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), {
          ...data, type: isShop ? 'shop' : 'auction',
          price: isShop ? parseFloat(newItem.price) : null,
          stock: isShop ? parseInt(newItem.stock) : null,
          purchases: isShop ? [] : null,
          currentBid: 0, topBidder: null, status: 'open', bids: [], createdAt: Date.now()
        });
        showAlert('Item added!', 'success');
      }
      setNewItem({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' });
      setImagePreview(null); setImagePreview2(null); setEditingItemId(null);
    } catch { showAlert('Failed to save item.', 'error'); }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file || file.size > 200 * 1024) return showAlert('Image too large (max 200KB).', 'error');
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
    if (!file || file.size > 500 * 1024) return showAlert('Background max 500KB.', 'error');
    const reader = new FileReader();
    reader.onloadend = () => setBgPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const saveBgImage = async () => {
    if (!bgPreview) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), { loginBg: bgPreview }, { merge: true });
    showAlert('Background updated!', 'success'); setBgPreview(null);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name: trimmed });
    setNewItem({ ...newItem, category: trimmed }); setNewCategoryName(''); setShowCategoryForm(false);
    showAlert('Category created!', 'success');
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (window.confirm(`Delete "${item?.name || 'this item'}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', id));
      showAlert('Item deleted.', 'info');
    }
  };

  const closeAuction = async (item) => {
    const msg = item.topBidder ? ` Winner: ${item.topBidder} (K${item.currentBid}).` : ' No bids placed.';
    if (window.confirm(`Close auction for "${item.name}"?${msg}`)) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id), { status: 'closed' });
      showAlert('Auction closed.', 'info');
    }
  };

  const scrollCarousel = (direction, categoryName) => {
    const el = document.getElementById(`carousel-${categoryName.replace(/\s+/g, '-')}`);
    if (el) el.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  // =============================================
  // =============================================
  // LOGIN PAGE
  // =============================================
  if (!user) {
    const bgStyle = appSettings?.loginBg
      ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.65)), url(${appSettings.loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: `linear-gradient(135deg, #336021 0%, #1a3a10 50%, #9E2A2B 100%)` };

    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", ...bgStyle }} className="min-h-screen flex items-center justify-center p-4">
        <AlertToast alerts={alerts} colors={colors} />

        {/* Terms Modal */}
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border-t-8 shadow-2xl" style={{ borderColor: colors.mossGreen }}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <AlertTriangle className="text-orange-500 w-6 h-6" /> Auction Terms
              </h2>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 mb-5">
                <p className="text-sm font-medium leading-relaxed text-gray-700">
                  These terms have been established by management. By proceeding, you acknowledge that all actions and decisions are your responsibility, including any resulting payroll deductions and penalties.
                </p>
              </div>
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer mb-6 border border-gray-200 hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 cursor-pointer accent-green-700" />
                <span className="text-sm font-semibold text-gray-700">I have read and agree to the auction terms.</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => { setShowTerms(false); setPendingUser(null); setTermsAccepted(false); }} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={completeRegistration} disabled={!termsAccepted || regLoading} style={{ backgroundColor: colors.mossGreen }} className={`flex-1 py-3 text-white rounded-xl font-bold transition-all ${(!termsAccepted || regLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
                  {regLoading ? 'Creating…' : 'Confirm & Join'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-white/15 backdrop-blur-sm p-5 rounded-full border-4 border-white/30 shadow-2xl">
  <img src={logo} alt="SupaMoto Logo" className="w-32 h-32 object-contain drop-shadow-2xl" />
</div>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">SupaMoto Auction 2026</h1>
            <p className="text-white/60 mt-2 text-xs font-medium tracking-widest uppercase">Chinja Malasha  Chinja Umoyo</p>
          </div>

          {/* Card with Tabs */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

            {/* Tab switcher */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => { setLoginName(''); setLoginPass(''); setRegName(''); setRegPass(''); }}
                className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${!showTerms && regName === '' && regPass === '' && loginName === '' && loginPass === '' || true ? '' : ''}`}
                id="tab-login"
                data-active="true"
                style={{ color: colors.mossGreen, borderBottom: `3px solid ${colors.mossGreen}` }}
                onClick={(e) => {
                  document.getElementById('panel-login').style.display = 'block';
                  document.getElementById('panel-register').style.display = 'none';
                  document.getElementById('tab-login').style.borderBottom = `3px solid ${colors.mossGreen}`;
                  document.getElementById('tab-login').style.color = colors.mossGreen;
                  document.getElementById('tab-login').style.background = 'white';
                  document.getElementById('tab-register').style.borderBottom = '3px solid transparent';
                  document.getElementById('tab-register').style.color = '#9ca3af';
                  document.getElementById('tab-register').style.background = '#f9fafb';
                }}
              >
                <User className="w-4 h-4" /> Login
              </button>
              <button
                id="tab-register"
                className="flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2"
                style={{ color: '#9ca3af', borderBottom: '3px solid transparent', background: '#f9fafb' }}
                onClick={() => {
                  document.getElementById('panel-login').style.display = 'none';
                  document.getElementById('panel-register').style.display = 'block';
                  document.getElementById('tab-register').style.borderBottom = `3px solid ${colors.tangerine}`;
                  document.getElementById('tab-register').style.color = colors.tangerine;
                  document.getElementById('tab-register').style.background = 'white';
                  document.getElementById('tab-login').style.borderBottom = '3px solid transparent';
                  document.getElementById('tab-login').style.color = '#9ca3af';
                  document.getElementById('tab-login').style.background = '#f9fafb';
                }}
              >
                <UserPlus className="w-4 h-4" /> Create Account
              </button>
            </div>

            {/* Login Panel */}
            <div id="panel-login" className="p-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required value={loginName} onChange={e => setLoginName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-600 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-600 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loginLoading}
                  style={{ backgroundColor: colors.mossGreen }}
                  className="w-full py-3 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 mt-2">
                  {loginLoading ? 'Logging in…' : 'Login'}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-4">
                New here?{' '}
                <button className="font-semibold hover:underline" style={{ color: colors.tangerine }}
                  onClick={() => {
                    document.getElementById('tab-register').click();
                  }}>Create an account</button>
              </p>
            </div>

            {/* Register Panel */}
            <div id="panel-register" className="p-8" style={{ display: 'none' }}>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required value={regName} onChange={e => setRegName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Create Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" required value={regPass} onChange={e => setRegPass(e.target.value)}
                      placeholder="Choose a password (min 4 chars)"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={regLoading}
                  style={{ backgroundColor: colors.tangerine }}
                  className="w-full py-3 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 mt-2">
                  {regLoading ? 'Creating…' : 'Sign Up'}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-4">
                Already have an account?{' '}
                <button className="font-semibold hover:underline" style={{ color: colors.mossGreen }}
                  onClick={() => {
                    document.getElementById('tab-login').click();
                  }}>Login here</button>
              </p>
            </div>

          </div>

          <p className="text-center text-white/30 text-xs mt-6">© 2026 SupaMoto Zambia · Staff Auction System</p>
        </div>
      </div>
    );
  }

  // AUCTION CLOSED LOCKOUT
  // =============================================
  if (user?.role !== 'admin' && isAuctionClosed()) {
    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: colors.cornsilk }} className="min-h-screen flex items-center justify-center p-6">
        <AlertToast alerts={alerts} colors={colors} />
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border-t-8 text-center" style={{ borderColor: colors.auburn }}>
          <div className="flex justify-center mb-4">
            <div style={{ backgroundColor: colors.auburn }} className="p-4 rounded-full shadow-md">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: colors.auburn }}>Auction Closed</h1>
          <p className="text-gray-600 mb-6">This auction has ended. Bidder access is now locked. Please contact the admin if you need help.</p>
          <button
            onClick={() => { setUser(null); setLoginName(''); setLoginPass(''); }}
            style={{ backgroundColor: colors.mossGreen }}
            className="w-full text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition-opacity"
          >Back to Login</button>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN APP
  // =============================================
  const filteredItems = items.filter(i =>
    (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.desc && i.desc.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (selectedCategory === 'All' || i.category === selectedCategory)
  );
  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: colors.cornsilk }} className="min-h-screen text-[#336021] pb-12 overflow-x-hidden">
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      <Navbar user={user} colors={colors} handleLogout={() => { setUser(null); setLoginName(''); setLoginPass(''); }} />
      <AlertToast alerts={alerts} colors={colors} />

      <main className="max-w-6xl mx-auto px-6 mt-8">

        {user.role === 'admin' && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold animate-pulse">Loading Admin Tools...</div>}>
            <AdminPanel
              items={items} dbUsers={dbUsers} db={db} appId={appId} doc={doc} setDoc={setDoc}
              showAlert={showAlert} colors={colors} appSettings={appSettings} bgPreview={bgPreview}
              handleBgUpload={handleBgUpload} saveBgImage={saveBgImage}
              editingItemId={editingItemId} setEditingItemId={setEditingItemId}
              showCategoryForm={showCategoryForm} setShowCategoryForm={setShowCategoryForm}
              newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
              handleAddCategory={handleAddCategory} newItem={newItem} setNewItem={setNewItem}
              categories={categories} handleAddOrUpdateItem={handleAddOrUpdateItem}
              handleImageUpload={handleImageUpload} imagePreview={imagePreview}
              imagePreview2={imagePreview2} setImagePreview={setImagePreview} setImagePreview2={setImagePreview2}
              auctionStartInput={auctionStartInput} setAuctionStartInput={setAuctionStartInput}
              auctionEndInput={auctionEndInput} setAuctionEndInput={setAuctionEndInput}
            />
          </Suspense>
        )}

        {user.role === 'user' && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div style={{ backgroundColor: colors.mossGreen }} className="p-3 rounded-full text-white"><Trophy className="w-8 h-8" /></div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: colors.mossGreen }}>Welcome, {user.name}! 👋</h2>
                <p className="text-gray-600 text-sm">Place your highest bids before time runs out.</p>
              </div>
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 px-6 py-3 rounded-2xl text-center min-w-[160px]">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Time Remaining</p>
              <p className="text-2xl font-mono font-black text-orange-700">{timeLeft || '—'}</p>
            </div>
          </div>
        )}

        {user.role === 'user' && <ItemsBought items={items} user={user} colors={colors} />}

        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="relative flex-grow">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search items…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-colors" />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-white font-medium text-gray-700">
            <option value="All">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(groupedItems).map(([category, catItems]) => (
              <div key={category}>
                <div className="flex justify-between items-end mb-4 px-1">
                  <h3 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.mossGreen }}>
                    <Tag className="w-6 h-6" style={{ color: colors.tangerine }} /> {category}
                    <span className="text-sm font-normal text-gray-500 ml-2">({catItems.length})</span>
                  </h3>
                  <div className="hidden md:flex gap-2">
                    <button onClick={() => scrollCarousel('left', category)} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => scrollCarousel('right', category)} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 shadow-sm"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                <div id={`carousel-${category.replace(/\s+/g, '-')}`} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 pt-2 hide-scroll px-1">
                  {catItems.map(item => (
                    <AuctionCard
                      key={item.id} item={item} colors={colors} user={user}
                      bidInput={bidInputs[item.id]} onBidChange={(id, val) => setBidInputs(prev => ({...prev, [id]: val}))}
                      onPlaceBid={placeBid} onBuyItem={buyItem}
                      onStartEdit={(i) => {
                        setNewItem({ name: i.name, desc: i.desc, startPrice: i.startPrice, category: i.category || categories[0], image: i.image || null, image2: i.image2 || null, isFaulty: i.isFaulty || false, faultDescription: i.faultDescription || '' });
                        setImagePreview(i.image || null); setImagePreview2(i.image2 || null);
                        setEditingItemId(i.id); window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onDelete={deleteItem} onClose={closeAuction} onExpandImage={setExpandedImage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Flame className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium" style={{ color: colors.mossGreen }}>
              {items.length === 0 ? 'No items on the auction block yet.' : 'No items match your search.'}
            </p>
          </div>
        )}
      </main>

      {expandedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-5xl max-h-full flex flex-col items-center">
            <button onClick={() => setExpandedImage(null)} className="absolute -top-12 right-0 text-white hover:text-orange-400"><XCircle className="w-10 h-10" /></button>
            <img src={expandedImage} alt="Expanded" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
