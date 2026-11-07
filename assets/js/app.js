
import { supabase } from './config.js';
import { getCurrentUser, getUserProfile } from './supabase.js';

const app = document.getElementById('app');

async function initializeApp() {
    app.innerHTML = `
        <main class="app-loading">
            <p>AulaPlan</p>
            <span>Conectando con tu espacio académico...</span>
        </main>
    `;

    try {
        const user = await getCurrentUser();

        if (user) {
            const profile = await getUserProfile(user.id);

            app.innerHTML = `
                <main class="app-loading">
                    <p>AulaPlan</p>
                    <span>Conexión exitosa con Supabase.</span>
                    <span>Sesión iniciada: ${escapeHTML(profile.full_name || user.email)}</span>
                </main>
            `;
        } else {
            app.innerHTML = `
                <main class="app-loading">
                    <p>AulaPlan</p>
                    <span>Conexión exitosa con Supabase.</span>
                    <span>El sistema está preparado para iniciar sesión.</span>
                </main>
            `;
        }

    } catch (error) {
        console.error('Error al iniciar AulaPlan:', error);

        app.innerHTML = `
            <main class="app-loading">
                <p>AulaPlan</p>
                <span>No fue posible conectar con Supabase.</span>
                <span>Revisa la configuración y vuelve a intentarlo.</span>
            </main>
        `;
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

supabase.auth.onAuthStateChange(() => {
    // La interfaz se actualizará al implementar el módulo de autenticación.
});

initializeApp();
