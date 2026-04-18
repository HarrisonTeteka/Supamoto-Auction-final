// src/lib/items.js
// IMPORTANT: this module maps Supabase (snake_case, ISO timestamps, normalized
// tables) back to the legacy Firebase shape (camelCase, ms timestamps, embedded
// arrays) so that AuctionCard, ItemsBought, AdminPanel keep working unchanged.

import { supabase } from './supabase'

// ============================================================
// PRIVATE — shape mapper
// ============================================================

// Supabase item (with joined bids, purchases) -> legacy Firebase item
const toLegacy = (row) => {
  if (!row) return row
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    type: row.type,
    category: row.category,
    status: row.status,
    startPrice: row.start_price,
    currentBid: row.current_bid,
    topBidder: row.top_bidder_name,
    price: row.price,
    stock: row.stock,
    image: row.image_url,
    image2: row.image_url_2,
    isFaulty: row.is_faulty,
    faultDescription: row.fault_description,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    bids: (row.bids || []).map((b) => ({
      bidder: b.bidder_name,
      amount: b.amount,
      timestamp: b.created_at ? new Date(b.created_at).getTime() : 0,
    })),
    purchases: (row.purchases || []).map((p) => ({
      buyer: p.buyer_name,
      timestamp: p.created_at ? new Date(p.created_at).getTime() : 0,
    })),
  }
}

// Single item + relations
const fetchItemWithRelations = async (id) => {
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      bids ( bidder_name, amount, created_at ),
      purchases ( buyer_name, created_at )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return toLegacy(data)
}

// All items + relations, newest first
const fetchAllItems = async () => {
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      bids ( bidder_name, amount, created_at ),
      purchases ( buyer_name, created_at )
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toLegacy)
}

// ============================================================
// READS (all return legacy-shape items)
// ============================================================

export const fetchItems = fetchAllItems

export const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('name').order('name')
  if (error) throw error
  return data.map((c) => c.name)
}

export const fetchSettings = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'auction_schedule')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  const v = data?.value || {}
  return {
    loginBg: v.login_bg || null,
    auctionStart: v.auction_start ? new Date(v.auction_start).getTime() : null,
    auctionEnd: v.auction_end ? new Date(v.auction_end).getTime() : null,
  }
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================
// place_bid() and buy_item() RPCs always UPDATE items alongside inserting
// into bids/purchases, so subscribing to items catches everything we need.

export const subscribeItems = (setItems) => {
  fetchAllItems().then(setItems).catch(console.error)

  const channel = supabase
    .channel('items-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items' }, async (payload) => {
      try {
        const fresh = await fetchItemWithRelations(payload.new.id)
        setItems((prev) => [fresh, ...prev].sort((a, b) => b.createdAt - a.createdAt))
      } catch (e) { console.error(e) }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' }, async (payload) => {
      try {
        const fresh = await fetchItemWithRelations(payload.new.id)
        setItems((prev) => prev.map((i) => (i.id === fresh.id ? fresh : i)))
      } catch (e) { console.error(e) }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
      setItems((prev) => prev.filter((i) => i.id !== payload.old.id))
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export const subscribeSettings = (setSettings) => {
  fetchSettings().then(setSettings).catch(console.error)
  const channel = supabase
    .channel('settings-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'key=eq.auction_schedule' },
      (payload) => {
        const v = payload.new.value || {}
        setSettings({
          loginBg: v.login_bg || null,
          auctionStart: v.auction_start ? new Date(v.auction_start).getTime() : null,
          auctionEnd: v.auction_end ? new Date(v.auction_end).getTime() : null,
        })
      }
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export const subscribeCategories = (setCategories) => {
  fetchCategories().then(setCategories).catch(console.error)
  const channel = supabase
    .channel('categories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
      fetchCategories().then(setCategories).catch(console.error)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Matches the old App.jsx usage: listener keyed on user.name
export const subscribeNotifications = (userName, onNotification) => {
  if (!userName) return () => {}

  let channel = null

  const setup = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', userName)
      .single()
    if (!profile) return
    const userId = profile.id

    // Deliver existing unread on mount
    const { data: existing } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_user_id', userId)
      .eq('read', false)
    if (existing?.length) {
      existing.forEach(onNotification)
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', existing.map((n) => n.id))
    }

    channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_user_id=eq.${userId}` },
        async (payload) => {
          onNotification(payload.new)
          await supabase.from('notifications').update({ read: true }).eq('id', payload.new.id)
        }
      )
      .subscribe()
  }
  setup().catch(console.error)

  return () => { if (channel) supabase.removeChannel(channel) }
}

// ============================================================
// MUTATIONS
// ============================================================

export const placeBid = async (itemId, amount) => {
  const { data, error } = await supabase.rpc('place_bid', {
    p_item_id: itemId,
    p_amount: amount,
  })
  if (error) throw new Error(error.message)
  return data
}

export const buyItem = async (itemId) => {
  const { data, error } = await supabase.rpc('buy_item', { p_item_id: itemId })
  if (error) throw new Error(error.message)
  return data
}

// Admin create — accepts the camelCase shape the form produces
export const createItem = async (form) => {
  const row = {
    name: form.name,
    description: form.desc || null,
    type: form.type || 'auction',
    category: form.category || null,
    start_price: form.startPrice ? parseFloat(form.startPrice) : null,
    price: form.price ? parseFloat(form.price) : null,
    stock: form.stock ? parseInt(form.stock) : null,
    image_url: form.image || null,
    image_url_2: form.image2 || null,
    is_faulty: !!form.isFaulty,
    fault_description: form.isFaulty ? form.faultDescription : null,
  }
  const { data, error } = await supabase.from('items').insert(row).select().single()
  if (error) throw error
  return data
}

// Admin edit — camelCase in, translated here
export const updateItem = async (id, form) => {
  const patch = {
    name: form.name,
    description: form.desc,
    category: form.category,
    start_price: form.startPrice ? parseFloat(form.startPrice) : null,
    image_url: form.image || null,
    image_url_2: form.image2 || null,
    is_faulty: !!form.isFaulty,
    fault_description: form.isFaulty ? form.faultDescription : null,
    price: form.price ? parseFloat(form.price) : null,
    stock: form.stock != null && form.stock !== '' ? parseInt(form.stock) : null,
  }
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k])
  const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteItem = async (id) => {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export const closeAuction = async (id) => {
  const { error } = await supabase.from('items').update({ status: 'closed' }).eq('id', id)
  if (error) throw error
}

export const addCategory = async (name) => {
  const { error } = await supabase.from('categories').insert({ name })
  if (error) throw error
}

// Called from AdminPanel — accepts ms timestamps, stores as ISO
export const saveSchedule = async ({ auctionStart, auctionEnd }) => {
  const current = await supabase
    .from('settings').select('value').eq('key', 'auction_schedule').single()
  const next = { ...(current.data?.value || {}) }
  next.auction_start = auctionStart ? new Date(auctionStart).toISOString() : null
  next.auction_end = auctionEnd ? new Date(auctionEnd).toISOString() : null
  const { error } = await supabase
    .from('settings')
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq('key', 'auction_schedule')
  if (error) throw error
}

export const saveLoginBg = async (url) => {
  const current = await supabase
    .from('settings').select('value').eq('key', 'auction_schedule').single()
  const next = { ...(current.data?.value || {}), login_bg: url }
  const { error } = await supabase
    .from('settings')
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq('key', 'auction_schedule')
  if (error) throw error
}

// AdminPanel's "Reset All Bids & Purchases"
export const resetAuctionData = async () => {
  const { data: items, error: fetchErr } = await supabase
    .from('items')
    .select('id, type, stock, purchases(id)')
  if (fetchErr) throw fetchErr

  // Wipe children first (FK would cascade anyway, but explicit is safer)
  const nullId = '00000000-0000-0000-0000-000000000000'
  await supabase.from('bids').delete().neq('id', nullId)
  await supabase.from('purchases').delete().neq('id', nullId)
  await supabase.from('notifications').delete().neq('id', nullId)

  // Reset items
  for (const it of items) {
    const patch = {
      current_bid: 0,
      top_bidder_id: null,
      top_bidder_name: null,
      status: 'open',
    }
    if (it.type === 'shop') {
      patch.stock = (it.stock || 0) + (it.purchases?.length || 0)
    }
    await supabase.from('items').update(patch).eq('id', it.id)
  }
}