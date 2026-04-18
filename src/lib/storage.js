// src/lib/storage.js
import { supabase } from './supabase'

const DEFAULT_ITEM_BUCKET = import.meta.env.VITE_SUPABASE_ITEM_BUCKET || 'item-images'

const extFromName = (name = '') => {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : 'bin'
}

export const uploadItemImage = async (file, { prefix = 'item', bucket = DEFAULT_ITEM_BUCKET } = {}) => {
  if (!file) throw new Error('No file provided for upload.')

  const ext = extFromName(file.name)
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type || undefined })

  if (uploadError) throw new Error(uploadError.message || 'Image upload failed.')

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('Could not generate public URL for uploaded image.')

  return { path, bucket, url: data.publicUrl }
}
