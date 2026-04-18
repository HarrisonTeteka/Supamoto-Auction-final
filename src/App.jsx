import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Flame, User, Trophy, Shield, Lock, Search, XCircle, Tag, ChevronLeft, ChevronRight, AlertTriangle, UserPlus } from 'lucide-react';
import logo from './assets/logo.webp';

// ── Supabase auth ─────────────────────────────────────────────────────────────
import { supabase } from './lib/supabase';
import { signIn, signUp, signOut, onAuthChange, getCurrentUser } from './lib/auth';

// ── Supabase data + storage ───────────────────────────────────────────────────
import {
  subscribeItems as subscribeToItems,
  subscribeSettings as subscribeToSettings,
  subscribeCategories as subscribeToCategories,
  subscribeNotifications as subscribeToNotifications,
  fetchItems,
  placeBid as placeBidRpc,
  buyItem as buyItemRpc,
  createItem as addItem,
  updateItem,
  deleteItem as deleteItemDb,
  closeAuction as closeAuctionDb,
  addCategory,
  saveLoginBg,
} from './lib/items';
import { uploadItemImage } from './lib/storage';
// ─────────────────────────────────────────────────────────────────────────────

import Navbar from './components/Navbar';
import AlertToast from './components/AlertToast';
import AuctionCard from './components/AuctionCard';
import ItemsBought from './components/ItemsBought';

const AdminPanel = lazy(() => import('./components/AdminPanel'));

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('AdminPanel crashed:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 mb-6 text-center">
          <p className="text-red-700 font-bold text-lg mb-2">⚠️ Admin Panel Error</p>
          <p className="text-red-500 text-sm mb-4">{this.state.error?.message || 'Something went wrong loading the admin panel.'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-all">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Timer helper ---
const calculateTimeLeft = (start, end) => {
  if (!start || !end) return null;
  const now = Date.now();
  if (now < start) {
    const diff = start - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `⏳ Starts in ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  }
  if (now >= end) return 'AUCTION CLOSED';
  const diff = end - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
};

export default function App() {
  const colors = { tangerine: '#F58202', mossGreen: '#336021', auburn: '#9E2A2B', cornsilk: '#F9EDCC' };

  const [authLoading, setAuthLoading]       = useState(true);
  const [user, setUser]                     = useState(null);
  const [currentPage, setCurrentPage]       = useState('auction');
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

  // Login state
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPass, setLoginPass]           = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);

  // Register state — split first/last like original
  const [regFirstName, setRegFirstName]     = useState('');
  const [regLastName, setRegLastName]       = useState('');
  const [regEmail, setRegEmail]             = useState('');
  const [regPass, setRegPass]               = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [regLoading, setRegLoading]         = useState(false);

  // --- App start ---
  useEffect(() => {
    let mounted = true;

    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const refreshItems = () => {
      fetchItems()
        .then((data) => { if (mounted) setItems(data); })
        .catch((err) => console.error('fetchItems failed:', err));
    };

    const loadUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, name, role');
      if (mounted && data) setDbUsers(data);
    };

    // Settings are public (RLS allows anon read), so we can subscribe immediately
    const unsubSettings = subscribeToSettings((data) => {
      if (mounted && data) setAppSettings(data);
    });

    // Auth-gated work: fetch items, load users, and set up realtime items
    // subscription AFTER we know who the user is. This prevents the RLS race
    // that caused items to appear empty on load.
    let unsubItems = () => {};

    const initAuth = async () => {
      try {
        const profile = await getCurrentUser();
        if (!mounted) return;
        currentUserId = profile?.id ?? null;
        setUser(profile);
        if (profile) {
          refreshItems();
          loadUsers();
          unsubItems = subscribeToItems(setItems);
        }
      } catch (err) {
        console.error('Auth init failed:', err);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    // Hard timeout — if auth takes >6s, stop spinner regardless
    const authTimeout = setTimeout(() => { if (mounted) setAuthLoading(false); }, 6000);
    initAuth().finally(() => clearTimeout(authTimeout));

    // Handles sign-in / sign-out AFTER mount. Skips INITIAL_SESSION internally
    // so it doesn't race initAuth.
    // Guard: only re-run setup if auth state actually changes (prevents loop
    // when onAuthChange fires after initAuth already set the user).
    let currentUserId = null;
    const unsubAuth = onAuthChange((profile) => {
      if (!mounted) return;
      const incomingId = profile?.id ?? null;
      if (incomingId === currentUserId) return; // no change — skip
      currentUserId = incomingId;
      setUser(profile);
      if (profile) {
        refreshItems();
        loadUsers();
        unsubItems();
        unsubItems = subscribeToItems(setItems);
      } else {
        setItems([]);
        unsubItems();
        unsubItems = () => {};
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      document.head.removeChild(link);
      unsubAuth();
      unsubItems();
      unsubSettings();
    };
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
    const unsubCat = subscribeToCategories((cats) => {
      if (cats.length > 0) setCategories(cats);
    });
    const unsubNotifs = subscribeToNotifications(user.name, (n) => {
      showAlert(`⚠️ ${n.message}`, 'error');
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

  const filteredItems = useMemo(() => items.filter(i => {
    const matchesSearch = (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (i.desc || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [items, searchQuery, selectedCategory]);

  const groupedItems = useMemo(() => filteredItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {}), [filteredItems]);

  const showAlert = (message, type = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 4000);
  };

  // --- LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = loginEmail.trim();
    const pass  = loginPass.trim();
    if (!email || !pass) return showAlert('Please enter your email and password.', 'error');
    setLoginLoading(true);
    try {
      const profile = await signIn(email, pass);
      setUser(profile);
      // Kick off items fetch immediately so user sees content without waiting
      // for onAuthChange round-trip.
      fetchItems().then(setItems).catch(console.error);
      showAlert(`Welcome back, ${profile.name}! 👋`, 'success');
    } catch (err) {
      showAlert(err.message || 'Login failed. Please try again.', 'error');
    }
    setLoginLoading(false);
  };

  // --- REGISTER ---
  const handleRegister = async (e) => {
    e.preventDefault();
    const firstName   = regFirstName.trim();
    const lastName    = regLastName.trim();
    const email       = regEmail.trim();
    const pass        = regPass.trim();
    const passConfirm = regPassConfirm.trim();
    if (!firstName || !lastName || !email || !pass || !passConfirm) return showAlert('Please fill in all fields.', 'error');
    if (pass.length < 4) return showAlert('Password must be at least 4 characters.', 'error');
    if (pass !== passConfirm) return showAlert('Passwords do not match.', 'error');
    if (!email.includes('@')) return showAlert('Please enter a valid company email.', 'error');
    const name = `${firstName} ${lastName}`;
    const existing = dbUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return showAlert('That name is already registered. Please contact admin.', 'error');
    setPendingUser({ name, email, password: pass });
    setShowTerms(true);
  };

  const completeRegistration = async () => {
    if (!termsAccepted || !pendingUser) return;
    setRegLoading(true);
    try {
      const profile = await signUp(pendingUser.name, pendingUser.email, pendingUser.password);
      setUser(profile);
      showAlert(`Account created! Welcome, ${pendingUser.name.split(' ')[0]}! 🎉`, 'success');
      setShowTerms(false); setTermsAccepted(false); setPendingUser(null);
      setRegFirstName(''); setRegLastName(''); setRegEmail(''); setRegPass(''); setRegPassConfirm('');
    } catch (err) {
      showAlert(err.message || 'Error creating account. Please try again.', 'error');
    }
    setRegLoading(false);
  };

  // --- Place Bid ---
  const placeBid = async (item, paymentMethod = 'payroll') => {
    if (user?.role !== 'admin' && isAuctionClosed()) return showAlert('The auction has closed. Bidding is locked.', 'error');
    const amt = parseFloat(bidInputs[item.id]);
    if (isNaN(amt) || amt <= 0) return showAlert('Please enter a valid bid amount.', 'error');
    try {
      await placeBidRpc(item.id, amt, paymentMethod);
      setBidInputs(prev => ({ ...prev, [item.id]: '' }));
      showAlert(`✅ Bid of K${amt.toLocaleString()} placed!`, 'success');
    } catch (err) { showAlert(err.message || 'Failed to place bid.', 'error'); }
  };

  // --- Buy Shop Item ---
  const buyItem = async (item, paymentMethod = 'payroll') => {
    if (!user) return;
    if (user?.role !== 'admin' && isAuctionClosed()) return showAlert('The auction has closed.', 'error');
    const alreadyBought = (item.purchases || []).some(p => p.buyer === user.name);
    if (alreadyBought) return showAlert('You have already reserved this item.', 'error');
    if (item.stock <= 0) return showAlert('Sorry, this item is out of stock.', 'error');
    try {
      await buyItemRpc(item.id, paymentMethod);
      showAlert(`✅ "${item.name}" reserved for K${item.price.toLocaleString()}!`, 'success');
    } catch (err) { showAlert(err.message || 'Purchase failed.', 'error'); }
  };

  // --- Add / Edit Item ---
  const handleAddOrUpdateItem = async (e) => {
    e.preventDefault();
    try {
      let image = newItem.image;
      let image2 = newItem.image2;
      if (image instanceof File) { const r = await uploadItemImage(image, { prefix: 'item' }); image = r.url; }
      if (image2 instanceof File) { const r = await uploadItemImage(image2, { prefix: 'item' }); image2 = r.url; }
      const data = { ...newItem, image, image2, startPrice: parseFloat(newItem.startPrice), faultDescription: newItem.isFaulty ? newItem.faultDescription : '' };
      if (editingItemId) {
        await updateItem(editingItemId, data);
        showAlert('Item updated!', 'success');
      } else {
        const isShop = newItem.type === 'shop';
        await addItem({ ...data, type: isShop ? 'shop' : 'auction', price: isShop ? parseFloat(newItem.price) : null, stock: isShop ? parseInt(newItem.stock) : null, currentBid: 0, topBidder: null, status: 'open' });
        showAlert('Item added!', 'success');
      }
      setNewItem({ name: '', desc: '', startPrice: '', category: '', image: null, image2: null, isFaulty: false, faultDescription: '' });
      setImagePreview(null); setImagePreview2(null); setEditingItemId(null);
    } catch (err) { showAlert('Failed to save item.', 'error'); console.error(err); }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showAlert('Image too large (max 2MB).', 'error');
    const previewUrl = URL.createObjectURL(file);
    setNewItem(prev => ({ ...prev, [field]: file }));
    if (field === 'image') setImagePreview(previewUrl);
    if (field === 'image2') setImagePreview2(previewUrl);
  };

  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 500 * 1024) return showAlert('Background max 500KB.', 'error');
    // Keep the File for upload on save, and a preview URL for immediate display
    const previewUrl = URL.createObjectURL(file);
    setBgPreview({ file, preview: previewUrl });
  };

  const saveBgImage = async () => {
    if (!bgPreview?.file) return;
    try {
      const { url } = await uploadItemImage(bgPreview.file, { prefix: 'login-bg' });
      await saveLoginBg(url);
      showAlert('Background updated!', 'success');
      URL.revokeObjectURL(bgPreview.preview);
      setBgPreview(null);
    } catch (err) {
      showAlert(err.message || 'Background upload failed.', 'error');
      console.error(err);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    await addCategory(trimmed);
    setNewItem({ ...newItem, category: trimmed }); setNewCategoryName(''); setShowCategoryForm(false);
    showAlert('Category created!', 'success');
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (window.confirm(`Delete "${item?.name || 'this item'}"? This cannot be undone.`)) {
      await deleteItemDb(id); showAlert('Item deleted.', 'info');
    }
  };

  const closeAuction = async (item) => {
    const msg = item.topBidder ? ` Winner: ${item.topBidder} (K${item.currentBid}).` : ' No bids placed.';
    if (window.confirm(`Close auction for "${item.name}"?${msg}`)) {
      await closeAuctionDb(item.id); showAlert('Auction closed.', 'info');
    }
  };

  const scrollCarousel = (direction, categoryName) => {
    const el = document.getElementById(`carousel-${categoryName.replace(/\s+/g, '-')}`);
    if (el) el.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null); setLoginEmail(''); setLoginPass(''); setCurrentPage('auction');
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #336021 0%, #1a3a10 50%, #9E2A2B 100%)' }}
        className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-semibold text-white/80">Loading SupaMoto Auction...</p>
        </div>
      </div>
    );
  }

  // =============================================
  // LOGIN PAGE
  // =============================================
  if (!user) {
    const bgStyle = appSettings?.loginBg
      ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.7)), url(${appSettings.loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: `linear-gradient(135deg, #336021 0%, #1a3a10 60%, #9E2A2B 100%)` };

    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", ...bgStyle }} className="min-h-screen flex items-center justify-center p-4">
        <AlertToast alerts={alerts} colors={colors} />

        {/* Terms Modal */}
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border-t-8 shadow-2xl" style={{ borderColor: colors.mossGreen }}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <AlertTriangle className="text-orange-500 w-6 h-6" /> Auction Terms & Conditions
              </h2>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 mb-5">
                <p className="text-sm font-medium leading-relaxed text-gray-700">
                  These terms have been established by management. By proceeding, you acknowledge that all bids placed are <strong>binding and final</strong>. Winning bids will be subject to payroll deductions as per management policy.
                </p>
              </div>
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer mb-6 border border-gray-200 hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 cursor-pointer accent-green-700" />
                <span className="text-sm font-semibold text-gray-700">I have read and agree to the auction terms.</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => { setShowTerms(false); setPendingUser(null); setTermsAccepted(false); }}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={completeRegistration} disabled={!termsAccepted || regLoading}
                  style={{ backgroundColor: colors.mossGreen }}
                  className={`flex-1 py-3 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${(!termsAccepted || regLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
                  {regLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Creating…</>
                    : 'Confirm & Join'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full border-2 border-white/20 shadow-2xl">
                <img src={logo} alt="SupaMoto Logo" className="w-20 h-20 object-contain drop-shadow-2xl" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">SupaMoto Auction 2026</h1>
            <p className="text-white/50 mt-1 text-xs font-medium tracking-widest uppercase">Chinja Malasha · Chinja Umoyo</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

            {/* Tab switcher */}
            <div className="flex">
              <button id="tab-login"
                style={{ color: colors.mossGreen, borderBottom: `3px solid ${colors.mossGreen}`, background: 'white' }}
                className="flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2"
                onClick={() => {
                  document.getElementById('panel-login').style.display = 'block';
                  document.getElementById('panel-register').style.display = 'none';
                  document.getElementById('tab-login').style.borderBottom = `3px solid ${colors.mossGreen}`;
                  document.getElementById('tab-login').style.color = colors.mossGreen;
                  document.getElementById('tab-login').style.background = 'white';
                  document.getElementById('tab-register').style.borderBottom = '3px solid transparent';
                  document.getElementById('tab-register').style.color = '#9ca3af';
                  document.getElementById('tab-register').style.background = '#f9fafb';
                }}>
                <User className="w-4 h-4" /> Login
              </button>
              <button id="tab-register"
                style={{ color: '#9ca3af', borderBottom: '3px solid transparent', background: '#f9fafb' }}
                className="flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2"
                onClick={() => {
                  document.getElementById('panel-login').style.display = 'none';
                  document.getElementById('panel-register').style.display = 'block';
                  document.getElementById('tab-register').style.borderBottom = `3px solid ${colors.tangerine}`;
                  document.getElementById('tab-register').style.color = colors.tangerine;
                  document.getElementById('tab-register').style.background = 'white';
                  document.getElementById('tab-login').style.borderBottom = '3px solid transparent';
                  document.getElementById('tab-login').style.color = '#9ca3af';
                  document.getElementById('tab-login').style.background = '#f9fafb';
                }}>
                <UserPlus className="w-4 h-4" /> Create Account
              </button>
            </div>

            {/* ── LOGIN PANEL ── */}
            <div id="panel-login" className="p-7">
              <p className="text-gray-500 text-sm mb-5 text-center">Welcome back! Enter your details to access the auction.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company Email</label>
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="yourname@supamoto.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50 focus:bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50 focus:bg-white" />
                  </div>
                </div>

                {/* Acknowledgement checkbox */}
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" required className="mt-0.5 w-4 h-4 cursor-pointer accent-green-700 shrink-0" />
                    <span className="text-xs text-gray-600 leading-relaxed">
                      I acknowledge that all bids placed are <strong className="text-gray-800">binding and final</strong>. Winning bids will be subject to payroll deductions as per management policy.
                    </span>
                  </label>
                </div>

                <button type="submit" disabled={loginLoading} style={{ backgroundColor: colors.mossGreen }}
                  className="w-full py-3.5 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                  {loginLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Verifying…</>
                    : <><Shield className="w-4 h-4" /> Login to Auction</>}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-4">
                New here?{' '}
                <button className="font-semibold hover:underline" style={{ color: colors.tangerine }}
                  onClick={() => document.getElementById('tab-register').click()}>Create an account</button>
              </p>
            </div>

            {/* ── REGISTER PANEL ── */}
            <div id="panel-register" className="p-7" style={{ display: 'none' }}>
              <p className="text-gray-500 text-sm mb-5 text-center">First time? Create your account to start bidding.</p>
              <form onSubmit={handleRegister} className="space-y-3">

                {/* First + Last Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" required value={regFirstName} onChange={e => setRegFirstName(e.target.value)}
                        placeholder="First name"
                        className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 transition-all bg-gray-50 focus:bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" required value={regLastName} onChange={e => setRegLastName(e.target.value)}
                        placeholder="Last name"
                        className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 transition-all bg-gray-50 focus:bg-white" />
                    </div>
                  </div>
                </div>

                {/* Company Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company Email</label>
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="yourname@supamoto.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 transition-all bg-gray-50 focus:bg-white" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" required value={regPass} onChange={e => setRegPass(e.target.value)}
                      placeholder="Create a password (min 4 chars)"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 transition-all bg-gray-50 focus:bg-white" />
                  </div>
                </div>

                {/* Re-enter Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Re-enter Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" required value={regPassConfirm} onChange={e => setRegPassConfirm(e.target.value)}
                      placeholder="Confirm your password"
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm outline-none focus:ring-2 transition-all bg-gray-50 focus:bg-white ${
                        regPassConfirm && regPassConfirm !== regPass ? 'border-red-400 focus:ring-red-300' :
                        regPassConfirm && regPassConfirm === regPass ? 'border-green-400 focus:ring-green-300' :
                        'border-gray-200'
                      }`} />
                  </div>
                  {regPassConfirm && regPassConfirm !== regPass && <p className="text-xs text-red-500 mt-1 font-medium">Passwords do not match</p>}
                  {regPassConfirm && regPassConfirm === regPass  && <p className="text-xs text-green-600 mt-1 font-medium">✓ Passwords match</p>}
                </div>

                <button type="submit" disabled={regLoading} style={{ backgroundColor: colors.tangerine }}
                  className="w-full py-3.5 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                  {regLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Creating Account…</>
                    : <><UserPlus className="w-4 h-4" /> Create My Account</>}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-4">
                Already have an account?{' '}
                <button className="font-semibold hover:underline" style={{ color: colors.mossGreen }}
                  onClick={() => document.getElementById('tab-login').click()}>Login here</button>
              </p>
            </div>

          </div>
          <p className="text-center text-white/25 text-xs mt-5">© 2026 SupaMoto Zambia · Staff Auction System</p>
        </div>
      </div>
    );
  }

  // AUCTION CLOSED LOCKOUT
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
          <button onClick={handleLogout} style={{ backgroundColor: colors.mossGreen }}
            className="w-full text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition-opacity">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN APP
  // =============================================
  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: colors.cornsilk }} className="min-h-screen text-[#336021] pb-12 overflow-x-hidden">
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      <Navbar user={user} colors={colors} handleLogout={handleLogout} />
      <AlertToast alerts={alerts} colors={colors} />

      <main className="max-w-6xl mx-auto px-6 mt-8">

        {/* Admin page nav tabs */}
        {user.role === 'admin' && (
          <div className="flex gap-2 mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-2 w-fit">
            <button onClick={() => setCurrentPage('auction')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={currentPage === 'auction' ? { backgroundColor: colors.mossGreen, color: 'white' } : { color: '#6b7280' }}>
              <Flame className="w-4 h-4" /> Auction
            </button>
            <button onClick={() => setCurrentPage('admin')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={currentPage === 'admin' ? { backgroundColor: colors.auburn, color: 'white' } : { color: '#6b7280' }}>
              <Shield className="w-4 h-4" /> Admin Panel
            </button>
          </div>
        )}

        {/* ── ADMIN PAGE ── */}
        {user.role === 'admin' && currentPage === 'admin' && (
          <ErrorBoundary>
            <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold animate-pulse">Loading Admin Tools...</div>}>
              <AdminPanel
                items={items} dbUsers={dbUsers}
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
          </ErrorBoundary>
        )}

        {/* ── AUCTION PAGE ── */}
        {currentPage === 'auction' && (
          <>
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

            {user.role === 'admin' && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div style={{ backgroundColor: colors.auburn }} className="p-3 rounded-full text-white"><Trophy className="w-8 h-8" /></div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: colors.auburn }}>Admin View — Live Auction</h2>
                    <p className="text-gray-600 text-sm">Viewing as admin. Switch to Admin Panel to manage items.</p>
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
                <input type="text" placeholder="Search items…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 transition-colors" />
              </div>
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-white font-medium text-gray-700">
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
                            setEditingItemId(i.id);
                            setCurrentPage('admin');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
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
          </>
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
