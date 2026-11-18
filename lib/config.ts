export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const accountsEnabled = Boolean(supabaseUrl && supabaseKey);
export const localPreview = !supabaseUrl && !supabaseKey;
