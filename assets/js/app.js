
import { supabase } from './config.js';
import { renderAuthUI } from './auth-ui.js';
import { renderDashboardUI } from './dashboard-ui.js';
import { renderSubjectsUI } from './subjects.js';
import { renderScheduleUI } from './schedule.js';
import { renderEvaluationsUI } from './evaluations.js';

const app = document.getElementById('app');

let currentUser = null;
let currentUserId = null;
let authInitialized = false;

// Mostrar dashboard
function showDashboard(user) {
    if (!user) return;

    currentUser = user;
    currentUserId = user.id;

    document.body.classList.remove('auth-page');

    renderDashboardUI(user);
}

// Mostrar inicio de sesión
function showLogin() {
    currentUser = null;
    currentUserId = null;

    document.body.classList.remove('dark');
    document.body.classList.add('auth-page');

    renderAuthUI();
}

// Navegación entre módulos
document.addEventListener('aulaplan:navigate', async (event) => {
    const section = event.detail?.section;

    if (!currentUser) return;

    try {
        switch (section) {

            case 'dashboard':
                showDashboard(currentUser);
                break;

            case 'subjects':
                await renderSubjectsUI();
                break;

            case 'schedule':
                await renderScheduleUI();
                break;

            case 'activities':
            case 'evaluations':
                await renderEvaluationsUI();
                break;

            default:
                console.log(
                    'Módulo pendiente de implementación:',
                    section
                );
                break;
        }
    } catch (error) {
        console.error('Error al abrir el módulo:', error);

        const content = document.getElementById(
            'dashboard-view-content'
        );

        if (content) {
            content.innerHTML = `
                <div class="app-error">
                    <h3>No fue posible abrir esta sección</h3>
                    <p>Revisa tu conexión e inténtalo nuevamente.</p>
                </div>
            `;
        }
    }
});

// Control de cambios de sesión
supabase.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_IN' && session?.user) {

        if (currentUserId !== session.user.id) {
            showDashboard(session.user);
        }
    }

    if (event === 'SIGNED_OUT') {
        showLogin();
    }
});

// Inicialización de AulaPlan
async function initializeApp() {

    if (authInitialized) return;

    authInitialized = true;

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

                <span>
                    No fue posible iniciar la aplicación.
                </span>

                <span>
                    Revisa tu conexión e inténtalo nuevamente.
                </span>

                <button onclick="location.reload()">
                    Reintentar
                </button>
            </main>
        `;
    }
}

initializeApp();
