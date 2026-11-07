
import { supabase } from './config.js';
import { renderAuthUI } from './auth-ui.js';

const app = document.getElementById('app');

async function initializeApp() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
            renderAuthenticatedState(data.session.user);
        } else {
            renderAuthUI();
        }

    } catch (error) {
        console.error('Error al iniciar AulaPlan:', error);

        app.innerHTML = `
            <main class="app-loading">
                <p>AulaPlan</p>
                <span>No fue posible iniciar la aplicación.</span>
                <span>Revisa tu conexión e inténtalo nuevamente.</span>
            </main>
        `;
    }
}

function renderAuthenticatedState(user) {
    const name = user.user_metadata?.full_name || user.email;

    app.innerHTML = `
        <main class="app-loading">
            <p>AulaPlan</p>
            <span>Sesión iniciada correctamente.</span>
            <span>Bienvenido, ${escapeHTML(name)}.</span>
            <button id="logout-button" class="auth-submit">
                Cerrar sesión
            </button>
        </main>
    `;

    document.getElementById('logout-button')
        .addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error(error);
                return;
            }

            renderAuthUI();
        });
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

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        renderAuthenticatedState(session.user);
    }

    if (event === 'SIGNED_OUT') {
        renderAuthUI();
    }
});

initializeApp();
