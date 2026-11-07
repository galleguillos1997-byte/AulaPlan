
import { supabase } from './config.js';

// ==========================================
// AULAPLAN - SERVICIOS DE BASE DE DATOS
// ==========================================

// Obtener el usuario actualmente autenticado
export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
}

// Obtener el perfil del estudiante
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;

    return data;
}

// Consultar registros de una tabla
export async function getRecords(table, options = {}) {
    let query = supabase.from(table).select('*');

    if (options.orderBy) {
        query = query.order(options.orderBy, {
            ascending: options.ascending ?? true
        });
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
}

// Crear un registro
export async function createRecord(table, values) {
    const { data, error } = await supabase
        .from(table)
        .insert(values)
        .select()
        .single();

    if (error) throw error;

    return data;
}

// Actualizar un registro
export async function updateRecord(table, id, values) {
    const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    return data;
}

// Eliminar un registro
export async function deleteRecord(table, id) {
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

    if (error) throw error;

    return true;
}

// Escuchar cambios de autenticación
export function onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

// Cerrar sesión
export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
}
