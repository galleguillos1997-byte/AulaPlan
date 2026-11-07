
import { supabase } from './config.js';
import { renderAuthUI } from './auth-ui.js';
import { renderDashboardUI } from './dashboard-ui.js';

const app = document.getElementById('app');

let currentUserId = null;

function showDashboard(user) {
    if (!user) return;

    currentUserId = user.id;
    document.body.classList.remove('auth-page');

    renderDashboardUI(user);
}

function showLogin() {
    currentUserId = null;
    document.body.classList.remove('dark');
    document.body.classList.add('auth-page');

    renderAuthUI();
}

// Detectar cambios de autenticación
supabase.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_IN' && session?.user) {
        showDashboard(session.user);
    }

    if (event === 'SIGNED_OUT') {
        showLogin();
    }

});

// Iniciar aplicación
async function initializeApp() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session?.user) {
            showDashboard(data.session.user);
        } else {
            showLogin();
        }

    } catch (error) {
        console.error('Error al iniciar AulaPlan:', error);

        app.innerHTML = `
            <main class="app-loading">
                <p>AulaPlan</p>
                <span>No fue posible iniciar la aplicación.</span>
                <span>Revisa tu conexión e inténtalo nuevamente.</span>
                <button onclick="location.reload()">
                    Reintentar
                </button>
            </main>
        `;
    }
}

initializeApp();
