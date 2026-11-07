
import { supabase } from './config.js';

// ======================================================
// AULAPLAN - HORARIO DE CLASES
// ======================================================

let currentUser = null;
let subjects = [];
let schedules = [];
let editingScheduleId = null;
let isSavingSchedule = false;

const weekdays = [
    { value: 1, label: 'Lunes', short: 'Lun' },
    { value: 2, label: 'Martes', short: 'Mar' },
    { value: 3, label: 'Miércoles', short: 'Mié' },
    { value: 4, label: 'Jueves', short: 'Jue' },
    { value: 5, label: 'Viernes', short: 'Vie' },
    { value: 6, label: 'Sábado', short: 'Sáb' },
    { value: 0, label: 'Domingo', short: 'Dom' }
];

const modalityLabels = {
    in_person: 'Presencial',
    online: 'Online',
    hybrid: 'Híbrida'
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

function formatTime(value) {
    return String(value || '').slice(0, 5);
}

function getSubject(subjectId) {
    return subjects.find(subject => subject.id === subjectId);
}

function getDayName(day) {
    return weekdays.find(item => item.value === Number(day))?.label || 'Día';
}

function getTodayWeekday() {
    return new Date().getDay();
}

function getTodayISO() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function getActiveSchedules() {
    const today = getTodayISO();

    return schedules.filter(item => {
        if (item.is_active === false) return false;

        if (item.valid_from && item.valid_from > today) {
            return false;
        }

        if (item.valid_until && item.valid_until < today) {
            return false;
        }

        return true;
    });
}

function getDuration(start, end) {
    const [startHour, startMinute] = formatTime(start)
        .split(':')
        .map(Number);

    const [endHour, endMinute] = formatTime(end)
        .split(':')
        .map(Number);

    return (endHour * 60 + endMinute) -
        (startHour * 60 + startMinute);
}

function formatDuration(start, end) {
    const minutes = getDuration(start, end);

    if (minutes <= 0) return '';

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours && remainingMinutes) {
        return `${hours} h ${remainingMinutes} min`;
    }

    if (hours) return `${hours} h`;

    return `${remainingMinutes} min`;
}

function getModalityIcon(modality) {
    const icons = {
        in_person: 'fa-building',
        online: 'fa-laptop',
        hybrid: 'fa-arrows-left-right'
    };

    return icons[modality] || 'fa-book';
}

function getSubjectColor(subject) {
    const color = String(subject?.color || '#6366f1');

    return /^#[0-9a-fA-F]{3,8}$/.test(color)
        ? color
        : '#6366f1';
}

// ======================================================
// INICIAR MÓDULO
// ======================================================

export async function renderScheduleUI() {
    const container = document.getElementById('dashboard-view-content');

    if (!container) {
        console.error('No se encontró dashboard-view-content.');
        return;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        container.innerHTML = `
            <div class="schedule-state">
                <i class="fa-solid fa-circle-exclamation"></i>
                <h2>Sesión no disponible</h2>
                <p>Inicia sesión nuevamente para consultar tu horario.</p>
            </div>
        `;
        return;
    }

    currentUser = data.user;

    container.innerHTML = `
        <section class="schedule-page">

            <header class="schedule-header">

                <div class="schedule-header-copy">
                    <span class="schedule-eyebrow">
                        ORGANIZACIÓN ACADÉMICA
                    </span>

                    <h1>Horario de clases</h1>

                    <p>
                        Organiza tus clases y visualiza tu semana académica.
                    </p>
                </div>

                <button
                    type="button"
                    id="schedule-new"
                    class="schedule-primary-button">

                    <i class="fa-solid fa-plus"></i>
                    Agregar clase

                </button>

            </header>

            <section class="schedule-summary">

                <article class="schedule-summary-card">
                    <div class="schedule-summary-icon">
                        <i class="fa-solid fa-calendar-check"></i>
                    </div>

                    <div>
                        <span>Bloques registrados</span>
                        <strong id="schedule-total">0</strong>
                    </div>
                </article>

                <article class="schedule-summary-card">
                    <div class="schedule-summary-icon">
                        <i class="fa-solid fa-book-open"></i>
                    </div>

                    <div>
                        <span>Asignaturas con clases</span>
                        <strong id="schedule-subject-total">0</strong>
                    </div>
                </article>

                <article class="schedule-summary-card">
                    <div class="schedule-summary-icon">
                        <i class="fa-regular fa-clock"></i>
                    </div>

                    <div>
                        <span>Horas semanales</span>
                        <strong id="schedule-hours">0 h</strong>
                    </div>
                </article>

            </section>

            <section class="schedule-calendar-section">

                <div class="schedule-section-heading">

                    <div>
                        <h2>Mi semana académica</h2>
                        <p>
                            Consulta tus clases y administra tus bloques horarios.
                        </p>
                    </div>

                    <span class="schedule-week-label">
                        <i class="fa-regular fa-calendar"></i>
                        Vista semanal
                    </span>

                </div>

                <div id="schedule-list" class="schedule-week">
                    <div class="schedule-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Cargando horario...
                    </div>
                </div>

            </section>

        </section>

        <div
            id="schedule-modal"
            class="schedule-modal"
            hidden>

            <div class="schedule-modal-backdrop" data-close-modal></div>

            <div
                class="schedule-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="schedule-modal-title">

                <header class="schedule-modal-header">

                    <div>
                        <span class="schedule-modal-eyebrow">
                            PLANIFICACIÓN ACADÉMICA
                        </span>

                        <h2 id="schedule-modal-title">
                            Agregar clase
                        </h2>

                        <p>
                            Completa los datos de tu bloque académico.
                        </p>
                    </div>

                    <button
                        type="button"
                        id="schedule-close"
                        class="schedule-modal-close"
                        aria-label="Cerrar formulario">

                        <i class="fa-solid fa-xmark"></i>

                    </button>

                </header>

                <form id="schedule-form">

                    <div class="schedule-form-field">

                        <label for="schedule-subject">
                            Asignatura <span>*</span>
                        </label>

                        <select id="schedule-subject" required>
                            <option value="">
                                Selecciona una asignatura
                            </option>
                        </select>

                    </div>

                    <div class="schedule-form-field">

                        <label for="schedule-day">
                            Día de la semana <span>*</span>
                        </label>

                        <select id="schedule-day" required>
                            ${weekdays.map(day => `
                                <option value="${day.value}">
                                    ${day.label}
                                </option>
                            `).join('')}
                        </select>

                    </div>

                    <div class="schedule-form-grid">

                        <div class="schedule-form-field">

                            <label for="schedule-start">
                                Hora de inicio <span>*</span>
                            </label>

                            <input
                                type="time"
                                id="schedule-start"
                                required>

                        </div>

                        <div class="schedule-form-field">

                            <label for="schedule-end">
                                Hora de término <span>*</span>
                            </label>

                            <input
                                type="time"
                                id="schedule-end"
                                required>

                        </div>

                    </div>

                    <div class="schedule-form-field">

                        <label for="schedule-modality">
                            Modalidad
                        </label>

                        <select id="schedule-modality">

                            <option value="in_person">
                                Presencial
                            </option>

                            <option value="online">
                                Online
                            </option>

                            <option value="hybrid">
                                Híbrida
                            </option>

                        </select>

                    </div>

                    <div class="schedule-form-field">

                        <label for="schedule-classroom">
                            Sala o lugar
                        </label>

                        <input
                            type="text"
                            id="schedule-classroom"
                            maxlength="100"
                            placeholder="Ej. Sala 204">

                    </div>

                    <div class="schedule-form-field">

                        <label for="schedule-teacher">
                            Docente
                        </label>

                        <input
                            type="text"
                            id="schedule-teacher"
                            maxlength="100"
                            placeholder="Nombre del docente">

                    </div>

                    <div class="schedule-form-divider">
                        Vigencia del horario
                    </div>

                    <div class="schedule-form-grid">

                        <div class="schedule-form-field">

                            <label for="schedule-valid-from">
                                Vigente desde
                            </label>

                            <input
                                type="date"
                                id="schedule-valid-from">

                        </div>

                        <div class="schedule-form-field">

                            <label for="schedule-valid-until">
                                Vigente hasta
                            </label>

                            <input
                                type="date"
                                id="schedule-valid-until">

                        </div>

                    </div>

                    <div
                        id="schedule-error"
                        class="schedule-error"
                        role="alert"
                        aria-live="polite">
                    </div>

                    <footer class="schedule-modal-actions">

                        <button
                            type="button"
                            id="schedule-cancel"
                            class="schedule-secondary-button">

                            Cancelar

                        </button>

                        <button
                            type="submit"
                            id="schedule-save"
                            class="schedule-primary-button">

                            <i class="fa-solid fa-check"></i>
                            Guardar horario

                        </button>

                    </footer>

                </form>

            </div>
        </div>
    `;

    bindScheduleEvents();

    await loadScheduleData();
}

// ======================================================
// CARGAR INFORMACIÓN
// ======================================================

async function loadScheduleData() {
    const list = document.getElementById('schedule-list');

    if (!list || !currentUser) return;

    list.innerHTML = `
        <div class="schedule-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Cargando horario...
        </div>
    `;

    try {
        const [subjectsResult, schedulesResult] = await Promise.all([

            supabase
                .from('subjects')
                .select('id, name, code, color')
                .eq('user_id', currentUser.id)
                .order('name', { ascending: true }),

            supabase
                .from('class_schedules')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('weekday', { ascending: true })
                .order('start_time', { ascending: true })

        ]);

        if (subjectsResult.error) {
            throw subjectsResult.error;
        }

        if (schedulesResult.error) {
            throw schedulesResult.error;
        }

        subjects = subjectsResult.data || [];
        schedules = schedulesResult.data || [];

        populateSubjectOptions();
        renderScheduleCalendar();

    } catch (error) {
        console.error('Error cargando horario:', error);

        list.innerHTML = `
            <div class="schedule-state schedule-state-error">

                <div class="schedule-state-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>No fue posible cargar tu horario</h3>

                <p>${escapeHTML(error.message)}</p>

                <button
                    type="button"
                    id="schedule-retry"
                    class="schedule-primary-button">

                    <i class="fa-solid fa-rotate-right"></i>
                    Reintentar

                </button>

            </div>
        `;

        document
            .getElementById('schedule-retry')
            ?.addEventListener('click', loadScheduleData);
    }
}

// ======================================================
// ASIGNATURAS DEL FORMULARIO
// ======================================================

function populateSubjectOptions(selectedId = '') {
    const select = document.getElementById('schedule-subject');

    if (!select) return;

    if (!subjects.length) {
        select.innerHTML = `
            <option value="">
                Primero registra una asignatura
            </option>
        `;
        return;
    }

    select.innerHTML = `
        <option value="">
            Selecciona una asignatura
        </option>

        ${subjects.map(subject => `
            <option
                value="${escapeHTML(subject.id)}"
                ${subject.id === selectedId ? 'selected' : ''}>

                ${escapeHTML(subject.name)}
                ${subject.code
                    ? ` · ${escapeHTML(subject.code)}`
                    : ''}

            </option>
        `).join('')}
    `;
}

// ======================================================
// RENDERIZAR HORARIO
// ======================================================

function renderScheduleCalendar() {
    const list = document.getElementById('schedule-list');

    if (!list) return;

    const activeSchedules = getActiveSchedules();

    const totalBlocks = activeSchedules.length;

    const subjectIds = new Set(
        activeSchedules.map(item => item.subject_id)
    );

    const totalMinutes = activeSchedules.reduce(
        (sum, item) => sum + getDuration(item.start_time, item.end_time),
        0
    );

    const totalHours = totalMinutes / 60;

    document.getElementById('schedule-total').textContent =
        totalBlocks;

    document.getElementById('schedule-subject-total').textContent =
        subjectIds.size;

    document.getElementById('schedule-hours').textContent =
        `${Number(totalHours.toFixed(1))} h`;

    if (!subjects.length) {
        renderEmptyState(
            'Primero registra tus asignaturas',
            'Para organizar tu horario necesitas registrar tus ramos en Mis asignaturas.',
            'Ir a mis asignaturas',
            'subjects'
        );

        return;
    }

    if (!activeSchedules.length) {
        renderEmptyState(
            'Tu semana está disponible',
            'Todavía no tienes clases vigentes. Agrega tu primer bloque para comenzar a organizarte.',
            'Agregar primera clase',
            'new'
        );

        return;
    }

    const today = getTodayWeekday();

    list.innerHTML = weekdays.map(day => {
        const daySchedules = activeSchedules
            .filter(item => Number(item.weekday) === day.value)
            .sort((a, b) =>
                formatTime(a.start_time).localeCompare(
                    formatTime(b.start_time)
                )
            );

        const isToday = day.value === today;

        return `
            <section class="schedule-day ${isToday ? 'schedule-day-today' : ''}">

                <header class="schedule-day-header">

                    <div class="schedule-day-name">
                        <span>${day.short}</span>
                        <h3>${day.label}</h3>
                    </div>

                    <span class="schedule-day-count">
                        ${daySchedules.length}
                        ${daySchedules.length === 1 ? 'clase' : 'clases'}
                    </span>

                </header>

                <div class="schedule-day-content">

                    ${daySchedules.length
                        ? daySchedules.map(renderClassCard).join('')
                        : `
                            <div class="schedule-no-classes">
                                <i class="fa-regular fa-calendar"></i>
                                <span>Sin clases</span>
                            </div>
                        `
                    }

                </div>

            </section>
        `;
    }).join('');

    bindClassCardEvents();
}

function renderClassCard(item) {
    const subject = getSubject(item.subject_id);

    if (!subject) return '';

    const color = getSubjectColor(subject);
    const duration = formatDuration(item.start_time, item.end_time);

    const modality = modalityLabels[item.modality] || 'Sin modalidad';

    return `
        <article
            class="schedule-class-card"
            style="--schedule-color:${color}">

            <div class="schedule-class-card-top">

                <div class="schedule-class-time">
                    <i class="fa-regular fa-clock"></i>

                    ${formatTime(item.start_time)}
                    <span>–</span>
                    ${formatTime(item.end_time)}
                </div>

                <div class="schedule-card-actions">

                    <button
                        type="button"
                        class="schedule-edit-button"
                        data-edit="${escapeHTML(item.id)}"
                        title="Editar clase"
                        aria-label="Editar clase">

                        <i class="fa-solid fa-pen"></i>

                    </button>

                    <button
                        type="button"
                        class="schedule-delete-button"
                        data-delete="${escapeHTML(item.id)}"
                        title="Eliminar clase"
                        aria-label="Eliminar clase">

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </div>

            </div>

            <div class="schedule-class-subject">
                ${escapeHTML(subject.name)}
            </div>

            ${subject.code ? `
                <div class="schedule-class-code">
                    ${escapeHTML(subject.code)}
                </div>
            ` : ''}

            <div class="schedule-class-details">

                <span>
                    <i class="fa-solid ${getModalityIcon(item.modality)}"></i>
                    ${escapeHTML(modality)}
                </span>

                ${item.classroom ? `
                    <span>
                        <i class="fa-solid fa-location-dot"></i>
                        ${escapeHTML(item.classroom)}
                    </span>
                ` : ''}

                ${item.teacher ? `
                    <span>
                        <i class="fa-solid fa-user"></i>
                        ${escapeHTML(item.teacher)}
                    </span>
                ` : ''}

            </div>

            <div class="schedule-class-duration">
                ${escapeHTML(duration)}
            </div>

        </article>
    `;
}

// ======================================================
// ESTADOS VACÍOS
// ======================================================

function renderEmptyState(title, description, buttonLabel, action) {
    const list = document.getElementById('schedule-list');

    list.innerHTML = `
        <div class="schedule-state">

            <div class="schedule-state-icon">
                <i class="fa-solid fa-calendar-days"></i>
            </div>

            <h3>${escapeHTML(title)}</h3>

            <p>${escapeHTML(description)}</p>

            <button
                type="button"
                id="schedule-empty-action"
                class="schedule-primary-button">

                <i class="fa-solid fa-plus"></i>
                ${escapeHTML(buttonLabel)}

            </button>

        </div>
    `;

    document
        .getElementById('schedule-empty-action')
        ?.addEventListener('click', () => {
            if (action === 'subjects') {
                document.dispatchEvent(
                    new CustomEvent('aulaplan:navigate', {
                        detail: { section: 'subjects' }
                    })
                );
            } else {
                openNewSchedule();
            }
        });
}

// ======================================================
// EVENTOS GENERALES
// ======================================================

function bindScheduleEvents() {
    document
        .getElementById('schedule-new')
        ?.addEventListener('click', openNewSchedule);

    document
        .getElementById('schedule-close')
        ?.addEventListener('click', closeScheduleModal);

    document
        .getElementById('schedule-cancel')
        ?.addEventListener('click', closeScheduleModal);

    document
        .getElementById('schedule-form')
        ?.addEventListener('submit', saveSchedule);

    document
        .getElementById('schedule-modal')
        ?.addEventListener('click', event => {
            if (event.target.matches('[data-close-modal]')) {
                closeScheduleModal();
            }
        });

    document.addEventListener('keydown', handleScheduleEscape);
}

function handleScheduleEscape(event) {
    if (event.key !== 'Escape') return;

    const modal = document.getElementById('schedule-modal');

    if (modal && !modal.hidden) {
        closeScheduleModal();
    }
}

function bindClassCardEvents() {
    document.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
            editSchedule(button.dataset.edit);
        });
    });

    document.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
            deleteSchedule(button.dataset.delete);
        });
    });
}

// ======================================================
// ABRIR MODAL
// ======================================================

function openScheduleModal() {
    const modal = document.getElementById('schedule-modal');

    if (!modal) return;

    modal.hidden = false;
    document.body.classList.add('schedule-modal-open');
}

function openNewSchedule() {
    if (!subjects.length) {
        alert(
            'Primero debes registrar una asignatura en Mis asignaturas.'
        );
        return;
    }

    editingScheduleId = null;

    const form = document.getElementById('schedule-form');

    form.reset();

    populateSubjectOptions();

    document.getElementById('schedule-modal-title').textContent =
        'Agregar clase';

    document.getElementById('schedule-save').innerHTML = `
        <i class="fa-solid fa-check"></i>
        Guardar horario
    `;

    document.getElementById('schedule-error').textContent = '';

    openScheduleModal();

    document.getElementById('schedule-subject')?.focus();
}

// ======================================================
// EDITAR CLASE
// ======================================================

function editSchedule(id) {
    const item = schedules.find(schedule => schedule.id === id);

    if (!item) return;

    editingScheduleId = id;

    populateSubjectOptions(item.subject_id);

    document.getElementById('schedule-day').value =
        String(item.weekday);

    document.getElementById('schedule-start').value =
        formatTime(item.start_time);

    document.getElementById('schedule-end').value =
        formatTime(item.end_time);

    document.getElementById('schedule-classroom').value =
        item.classroom || '';

    document.getElementById('schedule-modality').value =
        item.modality || 'in_person';

    document.getElementById('schedule-teacher').value =
        item.teacher || '';

    document.getElementById('schedule-valid-from').value =
        item.valid_from || '';

    document.getElementById('schedule-valid-until').value =
        item.valid_until || '';

    document.getElementById('schedule-modal-title').textContent =
        'Editar clase';

    document.getElementById('schedule-save').innerHTML = `
        <i class="fa-solid fa-check"></i>
        Guardar cambios
    `;

    document.getElementById('schedule-error').textContent = '';

    openScheduleModal();
}

// ======================================================
// CERRAR MODAL
// ======================================================

function closeScheduleModal() {
    const modal = document.getElementById('schedule-modal');

    if (!modal) return;

    modal.hidden = true;

    document.body.classList.remove('schedule-modal-open');

    editingScheduleId = null;
    isSavingSchedule = false;

    const form = document.getElementById('schedule-form');

    if (form) form.reset();

    const saveButton = document.getElementById('schedule-save');

    if (saveButton) {
        saveButton.disabled = false;
    }

    const error = document.getElementById('schedule-error');

    if (error) {
        error.textContent = '';
    }
}

// ======================================================
// VALIDAR CRUCES DE HORARIO
// ======================================================

function hasScheduleConflict(
    weekday,
    startTime,
    endTime,
    validFrom,
    validUntil
) {
    return schedules.some(item => {
        if (item.id === editingScheduleId) {
            return false;
        }

        if (item.is_active === false) {
            return false;
        }

        if (Number(item.weekday) !== Number(weekday)) {
            return false;
        }

        const existingStart = formatTime(item.start_time);
        const existingEnd = formatTime(item.end_time);

        const timeOverlap =
            startTime < existingEnd &&
            endTime > existingStart;

        if (!timeOverlap) return false;

        const newStart = validFrom || '0001-01-01';
        const newEnd = validUntil || '9999-12-31';

        const oldStart = item.valid_from || '0001-01-01';
        const oldEnd = item.valid_until || '9999-12-31';

        return (
            newStart <= oldEnd &&
            newEnd >= oldStart
        );
    });
}

// ======================================================
// VALIDACIÓN DEL FORMULARIO
// ======================================================

function validateScheduleForm() {
    const subjectId =
        document.getElementById('schedule-subject').value;

    const weekday =
        document.getElementById('schedule-day').value;

    const startTime =
        document.getElementById('schedule-start').value;

    const endTime =
        document.getElementById('schedule-end').value;

    const validFrom =
        document.getElementById('schedule-valid-from').value;

    const validUntil =
        document.getElementById('schedule-valid-until').value;

    if (!subjectId || !getSubject(subjectId)) {
        return 'Selecciona una asignatura válida.';
    }

    if (weekday === '') {
        return 'Selecciona un día de la semana.';
    }

    if (!startTime || !endTime) {
        return 'Debes ingresar la hora de inicio y término.';
    }

    if (endTime <= startTime) {
        return 'La hora de término debe ser posterior a la hora de inicio.';
    }

    if (validFrom && validUntil && validUntil < validFrom) {
        return 'La fecha de término no puede ser anterior a la fecha de inicio.';
    }

    if (hasScheduleConflict(
        Number(weekday),
        startTime,
        endTime,
        validFrom,
        validUntil
    )) {
        return 'Este bloque se cruza con otra clase registrada en ese día y período de vigencia.';
    }

    return null;
}

// ======================================================
// GUARDAR CLASE
// ======================================================

async function saveSchedule(event) {
    event.preventDefault();

    if (isSavingSchedule) return;

    const errorContainer = document.getElementById('schedule-error');
    const saveButton = document.getElementById('schedule-save');

    errorContainer.textContent = '';

    const validationError = validateScheduleForm();

    if (validationError) {
        errorContainer.textContent = validationError;
        return;
    }

    isSavingSchedule = true;

    const wasEditing = Boolean(editingScheduleId);
    const scheduleId = editingScheduleId;

    saveButton.disabled = true;
    saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Guardando...
    `;

    try {
        const payload = {
            user_id: currentUser.id,

            subject_id:
                document.getElementById('schedule-subject').value,

            weekday:
                Number(document.getElementById('schedule-day').value),

            start_time:
                document.getElementById('schedule-start').value,

            end_time:
                document.getElementById('schedule-end').value,

            classroom:
                document.getElementById('schedule-classroom')
                    .value.trim() || null,

            modality:
                document.getElementById('schedule-modality').value,

            teacher:
                document.getElementById('schedule-teacher')
                    .value.trim() || null,

            valid_from:
                document.getElementById('schedule-valid-from').value || null,

            valid_until:
                document.getElementById('schedule-valid-until').value || null,

            is_active: true
        };

        let result;

        if (wasEditing) {
            result = await supabase
                .from('class_schedules')
                .update(payload)
                .eq('id', scheduleId)
                .eq('user_id', currentUser.id);
        } else {
            result = await supabase
                .from('class_schedules')
                .insert(payload);
        }

        if (result.error) {
            throw result.error;
        }

        closeScheduleModal();

        await loadScheduleData();

    } catch (error) {
        console.error('Error guardando clase:', error);

        errorContainer.textContent =
            error.message || 'No fue posible guardar la clase.';

        isSavingSchedule = false;
        saveButton.disabled = false;

        saveButton.innerHTML = wasEditing
            ? '<i class="fa-solid fa-check"></i> Guardar cambios'
            : '<i class="fa-solid fa-check"></i> Guardar horario';
    }
}

// ======================================================
// ELIMINAR CLASE
// ======================================================

async function deleteSchedule(id) {
    const item = schedules.find(schedule => schedule.id === id);

    if (!item) return;

    const subject = getSubject(item.subject_id);

    const confirmed = confirm(
        `¿Deseas eliminar esta clase?\n\n` +
        `${subject?.name || 'Asignatura'}\n` +
        `${getDayName(item.weekday)} · ` +
        `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('class_schedules')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) {
            throw error;
        }

        await loadScheduleData();

    } catch (error) {
        console.error('Error eliminando clase:', error);

        alert(
            'No fue posible eliminar la clase.\n' +
            error.message
        );
    }
}
