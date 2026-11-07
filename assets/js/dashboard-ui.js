
import { logoutUser } from './auth.js';

const app = document.getElementById('app');

const navigation = [
    {
        label: 'PRINCIPAL',
        items: [
            { id: 'dashboard', icon: '⌂', label: 'Inicio' },
            { id: 'subjects', icon: '▤', label: 'Mis asignaturas' },
            { id: 'schedule', icon: '▦', label: 'Horario de clases' },
            { id: 'activities', icon: '✓', label: 'Evaluaciones y tareas' }
        ]
    },
    {
        label: 'ORGANIZACIÓN',
        items: [
            { id: 'calendar', icon: '▣', label: 'Calendario' },
            { id: 'planner', icon: '◷', label: 'Planificador de estudio' },
            { id: 'availability', icon: '◫', label: 'Disponibilidad' }
        ]
    },
    {
        label: 'SEGUIMIENTO',
        items: [
            { id: 'statistics', icon: '▥', label: 'Estadísticas' },
            { id: 'assistant', icon: '✧', label: 'Asistente AulaPlan' }
        ]
    }
];

function getInitials(name) {
    return String(name || 'Estudiante')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('');
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

function getFormattedDate() {
    return new Intl.DateTimeFormat('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(new Date());
}

function renderNavigation() {
    return navigation.map(group => `
        <div class="dashboard-nav-label">${group.label}</div>

        <nav class="dashboard-nav">
            ${group.items.map(item => `
                <button
                    type="button"
                    class="dashboard-nav-item ${item.id === 'dashboard' ? 'active' : ''}"
                    data-section="${item.id}">
                    <span class="dashboard-nav-icon">${item.icon}</span>
                    ${item.label}
                </button>
            `).join('')}
        </nav>
    `).join('');
}

function renderWeek() {
    const today = new Date();
    const monday = new Date(today);

    const day = monday.getDay();
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));

    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return days.map((name, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);

        const isToday = date.toDateString() === today.toDateString();

        return `
            <div class="dashboard-day ${isToday ? 'today' : ''}">
                <span>${name}</span>
                <strong>${date.getDate()}</strong>
            </div>
        `;
    }).join('');
}

function renderDashboard(user) {
    const metadata = user.user_metadata || {};
    const name = metadata.full_name || user.email || 'Estudiante';
    const safeName = escapeHTML(name);

    app.innerHTML = `
        <div class="dashboard">

            <div class="dashboard-overlay" id="dashboard-overlay"></div>

            <aside class="dashboard-sidebar">

                <div class="dashboard-logo">
                    <span class="dashboard-logo-icon">A</span>
                    AulaPlan.
                </div>

                ${renderNavigation()}

                <div class="dashboard-sidebar-bottom">
                    <div class="dashboard-user">
                        <div class="dashboard-avatar">
                            ${escapeHTML(getInitials(name))}
                        </div>

                        <div class="dashboard-user-info">
                            <strong>${safeName}</strong>
                            <span>Estudiante</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="dashboard-nav-item"
                        id="dashboard-logout">
                        <span class="dashboard-nav-icon">↪</span>
                        Cerrar sesión
                    </button>
                </div>

            </aside>

            <main class="dashboard-main">

                <header class="dashboard-header">

                    <div class="dashboard-header-actions">
                        <button
                            type="button"
                            class="dashboard-icon-button dashboard-menu-button"
                            id="dashboard-menu">
                            ☰
                        </button>

                        <div class="dashboard-header-title">
                            <strong>Mi espacio académico</strong>
                            <span>Organiza tu semana y alcanza tus objetivos</span>
                        </div>
                    </div>

                    <div class="dashboard-header-actions">
                        <button
                            type="button"
                            class="dashboard-icon-button"
                            title="Notificaciones">
                            ♧
                        </button>

                        <button
                            type="button"
                            class="dashboard-icon-button"
                            id="dashboard-theme"
                            title="Cambiar apariencia">
                            ◐
                        </button>
                    </div>

                </header>

                <div class="dashboard-content">

                    <section class="dashboard-welcome">
                        <div>
                            <h1>¡Hola, ${safeName.split(' ')[0]}! 👋</h1>
                            <p>Este es tu resumen académico. Organiza tus prioridades y aprovecha tu tiempo.</p>
                        </div>

                        <div class="dashboard-date">
                            ${escapeHTML(getFormattedDate())}
                        </div>
                    </section>

                    <section class="dashboard-metrics">

                        <article class="dashboard-card">
                            <div class="metric-top">
                                <span class="metric-label">Próximas evaluaciones</span>
                                <span class="metric-icon blue">▣</span>
                            </div>
                            <div class="metric-value">0</div>
                            <div class="metric-description">Evaluaciones registradas</div>
                        </article>

                        <article class="dashboard-card">
                            <div class="metric-top">
                                <span class="metric-label">Actividades pendientes</span>
                                <span class="metric-icon purple">✓</span>
                            </div>
                            <div class="metric-value">0</div>
                            <div class="metric-description">Tareas por completar</div>
                        </article>

                        <article class="dashboard-card">
                            <div class="metric-top">
                                <span class="metric-label">Horas de estudio</span>
                                <span class="metric-icon green">◷</span>
                            </div>
                            <div class="metric-value">0 h</div>
                            <div class="metric-description">Tiempo planificado esta semana</div>
                        </article>

                        <article class="dashboard-card">
                            <div class="metric-top">
                                <span class="metric-label">Asignaturas</span>
                                <span class="metric-icon orange">▤</span>
                            </div>
                            <div class="metric-value">0</div>
                            <div class="metric-description">Ramos registrados</div>
                        </article>

                    </section>

                    <div class="dashboard-grid">

                        <div class="dashboard-column">

                            <section class="dashboard-section dashboard-card">

                                <div class="dashboard-section-header">
                                    <div>
                                        <h2>Mi semana</h2>
                                        <p>Visualiza tu organización semanal</p>
                                    </div>

                                    <button class="dashboard-text-link"
                                        data-section="calendar">
                                        Ver calendario →
                                    </button>
                                </div>

                                <div class="dashboard-week">
                                    ${renderWeek()}
                                </div>

                                <div class="dashboard-agenda">
                                    <div class="dashboard-empty">
                                        <strong>Tu agenda está esperando</strong>
                                        Registra tus clases y actividades para comenzar a organizar tu semana.
                                    </div>
                                </div>

                            </section>

                            <section class="dashboard-section dashboard-card">

                                <div class="dashboard-section-header">
                                    <div>
                                        <h2>Próximas actividades</h2>
                                        <p>Evaluaciones, trabajos y tareas</p>
                                    </div>

                                    <button class="dashboard-text-link"
                                        data-section="activities">
                                        Ver todas →
                                    </button>
                                </div>

                                <div class="dashboard-empty">
                                    <strong>Aún no tienes actividades registradas</strong>
                                    Cuando agregues evaluaciones y tareas, aparecerán aquí.
                                </div>

                            </section>

                        </div>

                        <div class="dashboard-column">

                            <section class="dashboard-section dashboard-card">

                                <div class="dashboard-section-header">
                                    <div>
                                        <h2>Prioridades de estudio</h2>
                                        <p>Tu organización académica</p>
                                    </div>
                                </div>

                                <div class="dashboard-priorities">
                                    <div class="dashboard-empty">
                                        <strong>Primero necesitamos conocer tus asignaturas</strong>
                                        AulaPlan podrá recomendarte qué estudiar cuando registres tus ramos y evaluaciones.
                                    </div>
                                </div>

                            </section>

                            <section class="dashboard-assistant">
                                <h3>✧ Asistente AulaPlan</h3>
                                <p>
                                    Estoy aquí para ayudarte a organizar tus estudios,
                                    analizar tus próximas evaluaciones y aprovechar tus tiempos disponibles.
                                </p>

                                <button type="button" data-section="assistant">
                                    Conocer mi asistente →
                                </button>
                            </section>

                        </div>

                    </div>

                </div>

            </main>

        </div>
    `;

    bindDashboardEvents();
}

function bindDashboardEvents() {

    document.querySelectorAll('[data-section]').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;

            document.dispatchEvent(
                new CustomEvent('aulaplan:navigate', {
                    detail: { section }
                })
            );

            if (section !== 'dashboard') {
                alert('La sección "' + button.textContent.trim() +
                    '" estará disponible en la siguiente etapa.');
            }

            document.querySelector('.dashboard')
                ?.classList.remove('sidebar-open');
        });
    });

    document.getElementById('dashboard-menu')
        ?.addEventListener('click', () => {
            document.querySelector('.dashboard')
                ?.classList.toggle('sidebar-open');
        });

    document.getElementById('dashboard-overlay')
        ?.addEventListener('click', () => {
            document.querySelector('.dashboard')
                ?.classList.remove('sidebar-open');
        });

    document.getElementById('dashboard-logout')
        ?.addEventListener('click', async () => {
            try {
                await logoutUser();
            } catch (error) {
                console.error('No fue posible cerrar sesión:', error);
                alert('No fue posible cerrar sesión. Inténtalo nuevamente.');
            }
        });

    document.getElementById('dashboard-theme')
        ?.addEventListener('click', () => {
            document.body.classList.toggle('dark');
        });
}

export function renderDashboardUI(user) {
    renderDashboard(user);
}
