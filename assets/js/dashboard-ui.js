
import { supabase } from './config.js';
import { logoutUser } from './auth.js';

const app = document.getElementById('app');

const navigation = [
    {
        id: 'dashboard',
        icon: '⌂',
        label: 'Inicio'
    },
    {
        id: 'subjects',
        icon: '▤',
        label: 'Mis asignaturas'
    },
    {
        id: 'schedule',
        icon: '▦',
        label: 'Horario de clases'
    },
    {
        id: 'activities',
        icon: '✓',
        label: 'Evaluaciones y tareas'
    }
];

// MÓDULOS QUE SE INCORPORARÁN PRÓXIMAMENTE

const upcomingNavigation = [
    {
        id: 'study-planner',
        icon: '◷',
        label: 'Planificador inteligente de estudio'
    },
    {
        id: 'academic-assistant',
        icon: '✦',
        label: 'Asistente académico'
    },
    {
        id: 'habits',
        icon: '◎',
        label: 'Seguimiento de hábitos y rendimiento'
    },
    {
        id: 'statistics',
        icon: '▥',
        label: 'Estadísticas académicas'
    },
    {
        id: 'notifications',
        icon: '♧',
        label: 'Notificaciones y recordatorios'
    },
    {
        id: 'workplace',
        icon: '▦',
        label: 'AulaPlan Workplace'
    }
];

const weekdays = [
    { value: 1, label: 'Lunes', short: 'Lun' },
    { value: 2, label: 'Martes', short: 'Mar' },
    { value: 3, label: 'Miércoles', short: 'Mié' },
    { value: 4, label: 'Jueves', short: 'Jue' },
    { value: 5, label: 'Viernes', short: 'Vie' },
    { value: 6, label: 'Sábado', short: 'Sáb' },
    { value: 0, label: 'Domingo', short: 'Dom' }
];

const evaluationTypes = [
    'exam',
    'quiz',
    'control',
    'workshop',
    'assignment',
    'presentation'
];

const activityLabels = {
    exam: 'Examen',
    quiz: 'Prueba',
    control: 'Control',
    workshop: 'Taller',
    assignment: 'Trabajo',
    presentation: 'Presentación',
    task: 'Tarea',
    reading: 'Lectura',
    report: 'Informe',
    other: 'Actividad'
};

let dashboardUser = null;

let dashboardData = {
    subjects: [],
    schedules: [],
    activities: []
};

// ======================================================
// UTILIDADES
// ======================================================

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

function getInitials(name) {
    return String(name || 'Estudiante')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('');
}

function getFirstName(name) {
    return String(name || 'Estudiante').trim().split(/\s+/)[0];
}

function getFormattedDate() {
    return new Intl.DateTimeFormat('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(new Date());
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = parseDate(value);

    if (!date) return 'Fecha por definir';

    return new Intl.DateTimeFormat('es-CL', {
        day: 'numeric',
        month: 'short'
    }).format(date);
}

function formatTime(value) {
    return String(value || '').slice(0, 5);
}

function safeColor(value) {
    const color = String(value || '');

    return /^#[0-9a-fA-F]{6}$/.test(color)
        ? color
        : '#6366f1';
}

function getSubject(subjectId) {
    return dashboardData.subjects.find(
        subject => subject.id === subjectId
    );
}

function getActivityLabel(type) {
    return activityLabels[type] || 'Actividad';
}

function getWeekDates() {
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();

    monday.setDate(
        monday.getDate() + (day === 0 ? -6 : 1 - day)
    );

    monday.setHours(0, 0, 0, 0);

    return weekdays.map(item => {
        const date = new Date(monday);

        const offset = item.value === 0 ? 6 : item.value - 1;

        date.setDate(monday.getDate() + offset);

        return {
            ...item,
            date,
            dateKey: getLocalDateKey(date),
            isToday: date.toDateString() === today.toDateString()
        };
    });
}

// ======================================================
// CARGA DE DATOS
// ======================================================

async function loadDashboardData() {
    if (!dashboardUser?.id) {
        throw new Error('No se pudo identificar al estudiante.');
    }

    const userId = dashboardUser.id;

    const [
        subjectsResponse,
        schedulesResponse,
        activitiesResponse
    ] = await Promise.all([

        supabase
            .from('subjects')
            .select(`
                id,
                name,
                code,
                color,
                passing_grade,
                has_exam,
                exam_weight_percentage
            `)
            .eq('user_id', userId)
            .order('name', { ascending: true }),

        supabase
            .from('class_schedules')
            .select(`
                id,
                subject_id,
                weekday,
                start_time,
                end_time,
                classroom,
                modality,
                valid_from,
                valid_until,
                is_active
            `)
            .eq('user_id', userId)
            .order('weekday', { ascending: true })
            .order('start_time', { ascending: true }),

        supabase
            .from('activities')
            .select(`
                id,
                subject_id,
                title,
                activity_type,
                due_at,
                estimated_minutes,
                priority,
                status,
                grade,
                weight_percentage
            `)
            .eq('user_id', userId)
            .order('due_at', { ascending: true, nullsFirst: false })
    ]);

    if (subjectsResponse.error) {
        throw subjectsResponse.error;
    }

    if (schedulesResponse.error) {
        throw schedulesResponse.error;
    }

    if (activitiesResponse.error) {
        throw activitiesResponse.error;
    }

    dashboardData = {
        subjects: subjectsResponse.data || [],
        schedules: schedulesResponse.data || [],
        activities: activitiesResponse.data || []
    };
}

// ======================================================
// FILTROS Y CÁLCULOS
// ======================================================

function isScheduleValid(schedule, date) {
    if (schedule.is_active === false) return false;

    const dateKey = getLocalDateKey(date);

    if (schedule.valid_from && dateKey < schedule.valid_from) {
        return false;
    }

    if (schedule.valid_until && dateKey > schedule.valid_until) {
        return false;
    }

    return true;
}

function getSchedulesForDay(date) {
    return dashboardData.schedules
        .filter(schedule =>
            Number(schedule.weekday) === date.getDay() &&
            isScheduleValid(schedule, date)
        )
        .sort((a, b) =>
            formatTime(a.start_time).localeCompare(
                formatTime(b.start_time)
            )
        );
}

function getUpcomingActivities() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dashboardData.activities
        .filter(activity => {
            if (!activity.due_at) return false;

            if (
                activity.status === 'completed' ||
                activity.status === 'cancelled'
            ) {
                return false;
            }

            const dueDate = parseDate(activity.due_at);

            if (!dueDate) return false;

            dueDate.setHours(0, 0, 0, 0);

            return dueDate >= today;
        })
        .sort((a, b) =>
            new Date(a.due_at) - new Date(b.due_at)
        );
}

function getPendingActivities() {
    return dashboardData.activities.filter(activity =>
        activity.status === 'pending' ||
        activity.status === 'in_progress'
    );
}

function getSubjectAverage(subject) {
    const gradedActivities = dashboardData.activities.filter(activity =>
        activity.subject_id === subject.id &&
        activity.grade !== null &&
        activity.grade !== undefined &&
        activity.grade !== ''
    );

    if (!gradedActivities.length) return null;

    let weightedPoints = 0;
    let totalWeight = 0;
    let simpleTotal = 0;

    gradedActivities.forEach(activity => {
        const grade = Number(activity.grade);

        if (!Number.isFinite(grade)) return;

        simpleTotal += grade;

        let weight = Number(activity.weight_percentage || 0);

        if (activity.activity_type === 'exam') {
            weight = subject.has_exam
                ? Number(subject.exam_weight_percentage || 0)
                : 0;
        }

        if (weight > 0) {
            weightedPoints += grade * weight;
            totalWeight += weight;
        }
    });

    if (totalWeight > 0) {
        return weightedPoints / totalWeight;
    }

    return simpleTotal / gradedActivities.length;
}

// ======================================================
// MENÚ LATERAL
// ======================================================

function renderNavigation() {
    return `
        <div class="dashboard-nav-label">
            MENÚ PRINCIPAL
        </div>

        <nav class="dashboard-nav">

            ${navigation.map(item => `
                <button
                    type="button"
                    class="dashboard-nav-item ${item.id === 'dashboard' ? 'active' : ''}"
                    data-section="${item.id}">

                    <span class="dashboard-nav-icon">
                        ${item.icon}
                    </span>

                    <span>${item.label}</span>

                </button>
            `).join('')}

        </nav>

        <div class="dashboard-nav-label dashboard-nav-upcoming-label">
            PRÓXIMAMENTE
        </div>

        <div class="dashboard-nav-upcoming">

            ${upcomingNavigation.map(item => `
                <div
                    class="dashboard-nav-disabled"
                    aria-disabled="true"
                    title="Esta función estará disponible próximamente">

                    <span class="dashboard-nav-icon">
                        ${item.icon}
                    </span>

                    <span class="dashboard-nav-upcoming-name">
                        ${item.label}
                    </span>

                    <span class="dashboard-coming-soon">
                        Próximamente
                    </span>

                </div>
            `).join('')}

        </div>
    `;
}

// ======================================================
// ESTRUCTURA PRINCIPAL
// ======================================================

function renderDashboardShell(user) {
    const metadata = user.user_metadata || {};
    const name = metadata.full_name || user.email || 'Estudiante';

    const safeName = escapeHTML(name);
    const firstName = escapeHTML(getFirstName(name));

    app.innerHTML = `
        <div class="dashboard">

            <div
                class="dashboard-overlay"
                id="dashboard-overlay">
            </div>

            <aside class="dashboard-sidebar">

                <div class="dashboard-logo">
                    <span class="dashboard-logo-icon">A</span>
                    AulaPlan<span class="dashboard-logo-dot">.</span>
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
                        <span>Cerrar sesión</span>
                    </button>

                </div>

            </aside>

            <main class="dashboard-main">

                <header class="dashboard-header">

                    <div class="dashboard-header-actions">

                        <button
                            type="button"
                            class="dashboard-icon-button dashboard-menu-button"
                            id="dashboard-menu"
                            aria-label="Abrir menú">
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
                            id="dashboard-theme"
                            title="Cambiar apariencia">
                            ◐
                        </button>

                    </div>

                </header>

                <div
                    class="dashboard-content"
                    id="dashboard-view-content">

                    <div class="dashboard-loading">
                        <span class="dashboard-spinner"></span>
                        <p>Preparando tu espacio académico...</p>
                    </div>

                </div>

            </main>

        </div>
    `;

    bindDashboardEvents();

    renderDashboardContent(firstName);
}

// ======================================================
// CONTENIDO DEL DASHBOARD
// ======================================================

function renderDashboardContent(firstName) {
    const container = document.getElementById(
        'dashboard-view-content'
    );

    if (!container) return;

    const today = new Date();
    const weekDates = getWeekDates();

    const upcomingActivities = getUpcomingActivities();
    const pendingActivities = getPendingActivities();

    const upcomingEvaluations = upcomingActivities.filter(activity =>
        evaluationTypes.includes(activity.activity_type)
    );

    const pendingTasks = pendingActivities.filter(activity =>
        !evaluationTypes.includes(activity.activity_type)
    );

    const weekScheduleCount = weekDates.reduce(
        (total, day) => total + getSchedulesForDay(day.date).length,
        0
    );

    container.innerHTML = `

        <!-- BIENVENIDA -->

        <section class="dashboard-welcome">

            <div class="dashboard-welcome-copy">
                <span class="dashboard-eyebrow">
                    TU ESPACIO ACADÉMICO
                </span>

                <h1>¡Hola, ${firstName}! 👋</h1>

                <p>
                    Este es el resumen de tu vida académica.
                    Revisa tus clases, organiza tus compromisos
                    y mantén tus asignaturas al día.
                </p>
            </div>

            <div class="dashboard-date">
                <span>HOY</span>
                <strong>${escapeHTML(getFormattedDate())}</strong>
            </div>

        </section>

        <!-- INDICADORES -->

        <section class="dashboard-metrics">

            <article class="dashboard-metric-card">
                <div class="dashboard-metric-icon blue">▣</div>

                <div>
                    <span class="dashboard-metric-label">
                        Próximas evaluaciones
                    </span>

                    <strong class="dashboard-metric-value">
                        ${upcomingEvaluations.length}
                    </strong>

                    <small>Con fecha pendiente</small>
                </div>
            </article>

            <article class="dashboard-metric-card">
                <div class="dashboard-metric-icon purple">✓</div>

                <div>
                    <span class="dashboard-metric-label">
                        Tareas pendientes
                    </span>

                    <strong class="dashboard-metric-value">
                        ${pendingTasks.length}
                    </strong>

                    <small>Por completar</small>
                </div>
            </article>

            <article class="dashboard-metric-card">
                <div class="dashboard-metric-icon green">▦</div>

                <div>
                    <span class="dashboard-metric-label">
                        Clases esta semana
                    </span>

                    <strong class="dashboard-metric-value">
                        ${weekScheduleCount}
                    </strong>

                    <small>Bloques registrados</small>
                </div>
            </article>

            <article class="dashboard-metric-card">
                <div class="dashboard-metric-icon orange">▤</div>

                <div>
                    <span class="dashboard-metric-label">
                        Mis asignaturas
                    </span>

                    <strong class="dashboard-metric-value">
                        ${dashboardData.subjects.length}
                    </strong>

                    <small>Ramos registrados</small>
                </div>
            </article>

        </section>

        <!-- ACCESOS RÁPIDOS -->

        <section class="dashboard-quick-actions">

            <div>
                <span class="dashboard-eyebrow">ACCESOS RÁPIDOS</span>
                <h2>¿Qué necesitas organizar?</h2>
            </div>

            <div class="dashboard-quick-buttons">

                <button
                    type="button"
                    class="dashboard-quick-button"
                    data-section="subjects">
                    <span>＋</span>
                    Agregar asignatura
                </button>

                <button
                    type="button"
                    class="dashboard-quick-button"
                    data-section="schedule">
                    <span>＋</span>
                    Agregar clase
                </button>

                <button
                    type="button"
                    class="dashboard-quick-button"
                    data-section="activities">
                    <span>＋</span>
                    Agregar evaluación
                </button>

            </div>

        </section>

        <!-- CONTENIDO PRINCIPAL -->

        <div class="dashboard-main-grid">

            <div class="dashboard-primary-column">

                ${renderWeeklySchedule(weekDates)}

                ${renderUpcomingActivities(upcomingActivities)}

            </div>

            <div class="dashboard-secondary-column">

                ${renderSubjectOverview()}

                ${renderAcademicPriority(upcomingActivities)}

            </div>

        </div>

    `;

    bindDashboardContentEvents();
}

// ======================================================
// HORARIO SEMANAL
// ======================================================

function renderWeeklySchedule(weekDates) {
    return `
        <section class="dashboard-panel">

            <div class="dashboard-panel-header">

                <div>
                    <span class="dashboard-eyebrow">
                        ORGANIZACIÓN SEMANAL
                    </span>

                    <h2>Mi semana</h2>

                    <p>
                        Tus clases registradas para esta semana.
                    </p>
                </div>

                <button
                    type="button"
                    class="dashboard-text-link"
                    data-section="schedule">
                    Ver horario →
                </button>

            </div>

            <div class="dashboard-week-grid">

                ${weekDates.map(day => {
                    const schedules = getSchedulesForDay(day.date);

                    return `
                        <div class="
                            dashboard-week-day
                            ${day.isToday ? 'today' : ''}
                        ">

                            <div class="dashboard-week-day-header">
                                <span>${day.short}</span>
                                <strong>${day.date.getDate()}</strong>
                            </div>

                            <div class="dashboard-week-day-classes">

                                ${
                                    schedules.length
                                        ? schedules.map(schedule => {
                                            const subject = getSubject(
                                                schedule.subject_id
                                            );

                                            const subjectName = subject?.name ||
                                                'Asignatura';

                                            return `
                                                <div
                                                    class="dashboard-week-class"
                                                    style="--class-color: ${safeColor(subject?.color)}">

                                                    <strong>
                                                        ${escapeHTML(subjectName)}
                                                    </strong>

                                                    <span>
                                                        ${escapeHTML(formatTime(schedule.start_time))}
                                                        –
                                                        ${escapeHTML(formatTime(schedule.end_time))}
                                                    </span>

                                                </div>
                                            `;
                                        }).join('')
                                        : `
                                            <div class="dashboard-week-empty">
                                                Sin clases
                                            </div>
                                        `
                                }

                            </div>

                        </div>
                    `;
                }).join('')}

            </div>

        </section>
    `;
}

// ======================================================
// PRÓXIMAS ACTIVIDADES
// ======================================================

function renderUpcomingActivities(activities) {
    const visibleActivities = activities.slice(0, 6);

    return `
        <section class="dashboard-panel">

            <div class="dashboard-panel-header">

                <div>
                    <span class="dashboard-eyebrow">
                        AGENDA ACADÉMICA
                    </span>

                    <h2>Próximos compromisos</h2>

                    <p>
                        Evaluaciones, trabajos y tareas que se acercan.
                    </p>
                </div>

                <button
                    type="button"
                    class="dashboard-text-link"
                    data-section="activities">
                    Ver todos →
                </button>

            </div>

            ${
                visibleActivities.length
                    ? `
                        <div class="dashboard-upcoming-list">

                            ${visibleActivities.map(activity => {
                                const subject = getSubject(
                                    activity.subject_id
                                );

                                const dueDate = parseDate(activity.due_at);
                                const isEvaluation = evaluationTypes.includes(
                                    activity.activity_type
                                );

                                const priorityClass =
                                    activity.priority === 'urgent'
                                        ? 'urgent'
                                        : activity.priority === 'high'
                                            ? 'high'
                                            : '';

                                return `
                                    <article class="dashboard-upcoming-item">

                                        <div class="dashboard-upcoming-date">
                                            <strong>
                                                ${dueDate ? dueDate.getDate() : '—'}
                                            </strong>

                                            <span>
                                                ${dueDate
                                                    ? new Intl.DateTimeFormat('es-CL', {
                                                        month: 'short'
                                                    }).format(dueDate)
                                                    : ''}
                                            </span>
                                        </div>

                                        <div class="dashboard-upcoming-info">

                                            <strong>
                                                ${escapeHTML(activity.title)}
                                            </strong>

                                            <span>
                                                ${escapeHTML(subject?.name || 'Sin asignatura')}
                                                ·
                                                ${escapeHTML(getActivityLabel(activity.activity_type))}
                                            </span>

                                        </div>

                                        <span class="
                                            dashboard-activity-tag
                                            ${isEvaluation ? 'evaluation' : 'task'}
                                            ${priorityClass}
                                        ">
                                            ${isEvaluation ? 'Evaluación' : 'Actividad'}
                                        </span>

                                    </article>
                                `;
                            }).join('')}

                        </div>
                    `
                    : `
                        <div class="dashboard-empty-state">

                            <span class="dashboard-empty-icon">✓</span>

                            <strong>No tienes compromisos próximos</strong>

                            <p>
                                Cuando registres evaluaciones y tareas,
                                aparecerán aquí automáticamente.
                            </p>

                            <button
                                type="button"
                                class="dashboard-text-link"
                                data-section="activities">
                                Registrar actividad →
                            </button>

                        </div>
                    `
            }

        </section>
    `;
}

// ======================================================
// RESUMEN DE ASIGNATURAS Y NOTAS
// ======================================================

function renderSubjectOverview() {
    const subjects = dashboardData.subjects;

    return `
        <section class="dashboard-panel">

            <div class="dashboard-panel-header">

                <div>
                    <span class="dashboard-eyebrow">
                        SEGUIMIENTO ACADÉMICO
                    </span>

                    <h2>Mis asignaturas</h2>

                    <p>
                        Revisa tus ramos y las notas que has registrado.
                    </p>
                </div>

                <button
                    type="button"
                    class="dashboard-text-link"
                    data-section="subjects">
                    Ver todas →
                </button>

            </div>

            ${
                subjects.length
                    ? `
                        <div class="dashboard-subject-list">

                            ${subjects.slice(0, 6).map(subject => {
                                const average = getSubjectAverage(subject);

                                return `
                                    <article class="dashboard-subject-item">

                                        <span
                                            class="dashboard-subject-color"
                                            style="background: ${safeColor(subject.color)}">
                                        </span>

                                        <div class="dashboard-subject-info">

                                            <strong>
                                                ${escapeHTML(subject.name)}
                                            </strong>

                                            <span>
                                                ${escapeHTML(subject.code || 'Sin código')}
                                            </span>

                                        </div>

                                        <div class="dashboard-subject-grade">

                                            ${
                                                average !== null
                                                    ? `
                                                        <strong>
                                                            ${average.toFixed(1)}
                                                        </strong>

                                                        <span>Promedio registrado</span>
                                                    `
                                                    : `
                                                        <strong class="no-grade">—</strong>
                                                        <span>Sin notas</span>
                                                    `
                                            }

                                        </div>

                                    </article>
                                `;
                            }).join('')}

                        </div>
                    `
                    : `
                        <div class="dashboard-empty-state">

                            <span class="dashboard-empty-icon">▤</span>

                            <strong>Aún no tienes asignaturas</strong>

                            <p>
                                Registra tus ramos para comenzar
                                a organizar tu semestre.
                            </p>

                            <button
                                type="button"
                                class="dashboard-text-link"
                                data-section="subjects">
                                Agregar asignatura →
                            </button>

                        </div>
                    `
            }

        </section>
    `;
}

// ======================================================
// PRIORIDAD ACADÉMICA
// ======================================================

function renderAcademicPriority(activities) {
    const nextActivity = activities[0];

    if (!nextActivity) {
        return `
            <section class="dashboard-priority-panel">

                <span class="dashboard-eyebrow">
                    PLANIFICACIÓN
                </span>

                <h2>Todo al día</h2>

                <p>
                    Cuando registres tus próximas evaluaciones,
                    aquí podrás identificar cuál requiere
                    tu atención primero.
                </p>

                <button
                    type="button"
                    class="dashboard-text-link"
                    data-section="activities">
                    Revisar evaluaciones →
                </button>

            </section>
        `;
    }

    const subject = getSubject(nextActivity.subject_id);
    const dueDate = parseDate(nextActivity.due_at);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysRemaining = dueDate
        ? Math.ceil(
            (new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate()
            ) - today) / 86400000
        )
        : null;

    let urgency = 'Próximamente';

    if (daysRemaining === 0) {
        urgency = 'Es hoy';
    } else if (daysRemaining === 1) {
        urgency = 'Es mañana';
    } else if (daysRemaining !== null && daysRemaining > 1) {
        urgency = `En ${daysRemaining} días`;
    }

    return `
        <section class="dashboard-priority-panel">

            <span class="dashboard-eyebrow">
                TU PRÓXIMA PRIORIDAD
            </span>

            <div class="dashboard-priority-icon">✦</div>

            <span class="dashboard-priority-status">
                ${escapeHTML(urgency)}
            </span>

            <h2>
                ${escapeHTML(nextActivity.title)}
            </h2>

            <p>
                ${escapeHTML(subject?.name || 'Sin asignatura')}
            </p>

            <div class="dashboard-priority-date">
                <span>Fecha de entrega</span>
                <strong>${escapeHTML(formatDate(nextActivity.due_at))}</strong>
            </div>

            <button
                type="button"
                class="dashboard-priority-button"
                data-section="activities">
                Revisar mis compromisos →
            </button>

        </section>
    `;
}

// ======================================================
// EVENTOS
// ======================================================

function navigateTo(section) {
    document.dispatchEvent(
        new CustomEvent('aulaplan:navigate', {
            detail: { section }
        })
    );

    document.querySelector('.dashboard')
        ?.classList.remove('sidebar-open');

    document.querySelectorAll('.dashboard-nav-item[data-section]')
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.section === section
            );
        });
}

function bindDashboardContentEvents() {
    document.querySelectorAll(
        '#dashboard-view-content [data-section]'
    ).forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.section);
        });
    });
}

function bindDashboardEvents() {
    document.querySelectorAll(
        '.dashboard-sidebar [data-section]'
    ).forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.section);
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

                alert(
                    'No fue posible cerrar sesión. Inténtalo nuevamente.'
                );
            }
        });

    document.getElementById('dashboard-theme')
        ?.addEventListener('click', () => {
            document.body.classList.toggle('dark');
        });
}

// ======================================================
// INICIALIZACIÓN PÚBLICA
// ======================================================

export function renderDashboardUI(user) {
    dashboardUser = user;

    renderDashboardShell(user);

    loadDashboardData()
        .then(() => {
            const metadata = user.user_metadata || {};
            const name = metadata.full_name || user.email || 'Estudiante';

            renderDashboardContent(
                escapeHTML(getFirstName(name))
            );
        })
        .catch(error => {
            console.error(
                'Error al cargar el dashboard:',
                error
            );

            const container = document.getElementById(
                'dashboard-view-content'
            );

            if (!container) return;

            container.innerHTML = `
                <div class="dashboard-load-error">

                    <strong>
                        No pudimos cargar tu información académica.
                    </strong>

                    <p>
                        Revisa tu conexión e inténtalo nuevamente.
                    </p>

                    <button
                        type="button"
                        id="dashboard-retry">
                        Reintentar
                    </button>

                </div>
            `;

            document.getElementById('dashboard-retry')
                ?.addEventListener('click', () => {
                    renderDashboardUI(user);
                });
        });
}
