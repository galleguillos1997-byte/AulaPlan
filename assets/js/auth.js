
import { supabase } from './config.js';

// ==========================================
// AULAPLAN - AUTENTICACIÓN
// ==========================================

// REGISTRO DE ESTUDIANTES
export async function registerUser({
    fullName,
    email,
    password,
    institution = '',
    career = ''
}) {
    const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
            data: {
                full_name: fullName.trim(),
                institution: institution.trim(),
                career: career.trim()
            }
        }
    });

    if (error) throw error;

    return data;
}

// INICIO DE SESIÓN
export async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
    });

    if (error) throw error;

    return data;
}

// CIERRE DE SESIÓN
export async function logoutUser() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    return true;
}

// RECUPERACIÓN DE CONTRASEÑA
export async function recoverPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
            redirectTo: window.location.origin +
                window.location.pathname + '?reset-password=true'
        }
    );

    if (error) throw error;

    return true;
}

// ACTUALIZAR CONTRASEÑA
export async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) throw error;

    return data;
}

// OBTENER SESIÓN ACTUAL
export async function getSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    return data.session;
}

// OBTENER USUARIO ACTUAL
export async function getAuthenticatedUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
}

// ESCUCHAR CAMBIOS DE SESIÓN
export function listenToAuthChanges(callback) {
    return supabase.auth.onAuthStateChange(callback);
}
