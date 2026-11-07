
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==========================================
// AULAPLAN - CONFIGURACIÓN DE SUPABASE
// ==========================================

export const SUPABASE_URL =
    'https://tkikebgmnmoqpghjkhyb.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_1RoMA4FLeNCOBL1xgyfsHw_wPLW9pEl';

// ==========================================
// CLIENTE SUPABASE
// ==========================================

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);
