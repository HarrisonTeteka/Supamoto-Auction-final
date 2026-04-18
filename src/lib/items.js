// src/lib/items.js
// Maps Supabase (snake_case, ISO timestamps, normalized tables) back to the
// legacy Firebase shape (camelCase, ms timestamps, embedded arrays) so the
// child components keep working unchanged.
//
// Key change vs. previous: subscribeItems no longer does an eager initial
// fetch. App.jsx controls when to fetch (after auth is confirmed) via
// refreshItems(). This prevents the "items don't show up" bug caused by
// fetching before Supabase has a session.

import { supabase } from './supabase'

// ============================================================
// Shape mapper
// ============================================================
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
      payment_method: b.payment_method || 'payroll',
      timestamp: b.created_at ? new Date(b.created_at).getTime() : 0,
    })),
    purchases: (row.purchases || []).map((p) => ({
      buyer: p.buyer_name,
      payment_method: p.payment_method || 'payroll',
      timestamp: p.created_at ? new Date(p.created_at).getTime() : 0,
    })),
  }
}

const fetchItemWithRelations = async (id) => {
  const { data, error } = await supabase
    .from('items')
    .select(`*, bids(bidder_name, amount, payment_method, created_at), purchases(buyer_name, payment_method, created_at)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return toLegacy(data)
}

const fetchAllItems = async () => {
  const { data, error } = await supabase
    .from('items')
    .select(`*, bids(bidder_name, amount, payment_method, created_at), purchases(buyer_name, payment_method, created_at)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toLegacy)
}

// ============================================================
// Reads
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
// Realtime subscriptions
// ============================================================
// subscribeItems now only sets up the realtime listener. Initial fetch is
// the caller's responsibility — App.jsx calls refreshItems() after auth.
// This fixes the "items empty on load" bug (RLS blocked the fetch that
// happened before session hydration).
export const subscribeItems = (setItems) => {
  const channel = supabase
    .channel('items-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items' }, async (payload) => {
      try {
        const fresh = await fetchItemWithRelations(payload.new.id)
        setItems((prev) => [fresh, ...prev].sort((a, b) => b.createdAt - a.createdAt))
      } catch (e) { console.error('items insert refresh failed:', e) }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' }, async (payload) => {
      try {
        const fresh = await fetchItemWithRelations(payload.new.id)
        setItems((prev) => prev.map((i) => (i.id === fresh.id ? fresh : i)))
      } catch (e) { console.error('items update refresh failed:', e) }
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

    const { data: existing } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_user_id', userId)
      .eq('read', false)
    if (existing?.length) {
      existing.forEach(onNotification)
      await supabase.from('notifications').update({ read: true }).in('id', existing.map((n) => n.id))
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
// Mutations
// ============================================================
export const placeBid = async (itemId, amount, paymentMethod = 'payroll') => {
  const { data, error } = await supabase.rpc('place_bid', {
    p_item_id: itemId,
    p_amount: amount,
    p_payment_method: paymentMethod,
  })
  if (error) throw new Error(error.message)
  return data
}

export const buyItem = async (itemId, paymentMethod = 'payroll') => {
  const { data, error } = await supabase.rpc('buy_item', {
    p_item_id: itemId,
    p_payment_method: paymentMethod,
  })
  if (error) throw new Error(error.message)
  return data
}

export const createItem = async (form) => {
  const row = {
    name: form.name,
    description: form.desc || null,
    type: form.type || 'auction',
    category: form.category || null,
    start_price: form.startPrice ? parseFloat(form.startPrice) : null,
    price: form.price ? parseFloat(form.price) : null,
    stock: form.stock ? parseInt(form.stock) : null,
    image_url: typeof form.image === 'string' ? form.image : null,
    image_url_2: typeof form.image2 === 'string' ? form.image2 : null,
    is_faulty: !!form.isFaulty,
    fault_description: form.isFaulty ? form.faultDescription : null,
  }
  const { data, error } = await supabase.from('items').insert(row).select().single()
  if (error) throw error
  return data
}

export const updateItem = async (id, form) => {
  const patch = {
    name: form.name,
    description: form.desc,
    category: form.category,
    start_price: form.startPrice ? parseFloat(form.startPrice) : null,
    // Only overwrite image fields if a URL string is provided. File instances
    // should have been resolved to URLs upstream; undefined leaves the column alone.
    image_url: typeof form.image === 'string' ? form.image : undefined,
    image_url_2: typeof form.image2 === 'string' ? form.image2 : undefined,
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

export const saveSchedule = async ({ auctionStart, auctionEnd }) => {
  const current = await supabase.from('settings').select('value').eq('key', 'auction_schedule').single()
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
  const current = await supabase.from('settings').select('value').eq('key', 'auction_schedule').single()
  const next = { ...(current.data?.value || {}), login_bg: url }
  const { error } = await supabase
    .from('settings')
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq('key', 'auction_schedule')
  if (error) throw error
}

export const resetAuctionData = async () => {
  const { data: items, error: itemsErr } = await supabase
    .from('items')
    .select('id, type, stock')
  if (itemsErr) throw itemsErr

  const { data: purchases, error: purchasesErr } = await supabase
    .from('purchases')
    .select('id, item_id')
  if (purchasesErr) throw purchasesErr

  const purchaseCountByItem = {}
  for (const p of purchases || []) {
    purchaseCountByItem[p.item_id] = (purchaseCountByItem[p.item_id] || 0) + 1
  }

  const nullId = '00000000-0000-0000-0000-000000000000'
  const { error: bidsDeleteErr } = await supabase.from('bids').delete().neq('id', nullId)
  if (bidsDeleteErr) throw bidsDeleteErr

  const { error: purchasesDeleteErr } = await supabase.from('purchases').delete().neq('id', nullId)
  if (purchasesDeleteErr) throw purchasesDeleteErr

  const { error: notificationsDeleteErr } = await supabase.from('notifications').delete().neq('id', nullId)
  if (notificationsDeleteErr) throw notificationsDeleteErr

  for (const it of items || []) {
    const patch = {
      current_bid: 0,
      top_bidder_id: null,
      top_bidder_name: null,
      status: 'open',
    }

    if (it.type === 'shop') {
      const soldCount = purchaseCountByItem[it.id] || 0
      patch.stock = (Number(it.stock) || 0) + soldCount
    }

    const { error: updateErr } = await supabase
      .from('items')
      .update(patch)
      .eq('id', it.id)
    if (updateErr) throw updateErr
  }
}