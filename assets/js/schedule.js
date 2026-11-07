
import { supabase } from './config.js';

let schedules = [];
let subjects = [];
let editingScheduleId = null;

const weekdays = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
];

const modalityLabels = {
    in_person: 'Presencial',
    online: 'Online',
    hybrid: 'Híbrida'
};

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

function getSubject(id) {
    return subjects.find(subject => subject.id === id);
}

function getDayName(day) {
    return weekdays.find(item => item.value === Number(day))?.label || 'Día';
}

export async function renderScheduleUI() {
    const app = document.getElementById('dashboard-view-content');

    if (!app) {
        console.error('No se encontró el contenedor del módulo.');
        return;
    }

    app.innerHTML = `
        <main class="schedule-page">
            <header class="schedule-header">
                <div>
                    <h1>Horario de clases</h1>
                    <p>Organiza tus clases y visualiza tu semana académica.</p>
                </div>

                <button id="schedule-new" class="schedule-primary-button">
                    + Agregar clase
                </button>
            </header>

            <section class="schedule-summary">
                <div class="schedule-summary-card">
                    <span>Bloques registrados</span>
                    <strong id="schedule-total">0</strong>
                </div>

                <div class="schedule-summary-card">
                    <span>Asignaturas con clases</span>
                    <strong id="schedule-subject-total">0</strong>
                </div>
            </section>

            <section class="schedule-calendar-section">
                <div class="schedule-section-heading">
                    <div>
                        <h2>Mi semana académica</h2>
                        <p>Selecciona un bloque para editarlo.</p>
                    </div>
                </div>

                <div id="schedule-list" class="schedule-week">
                    <p>Cargando horario...</p>
                </div>
            </section>
        </main>

        <div id="schedule-modal" class="schedule-modal" hidden>
            <div class="schedule-modal-content">
                <div class="schedule-modal-header">
                    <div>
                        <h2 id="schedule-modal-title">Agregar clase</h2>
                        <p>Completa los datos de tu bloque académico.</p>
                    </div>

                    <button type="button" id="schedule-close"
                        aria-label="Cerrar">✕</button>
                </div>

                <form id="schedule-form">
                    <label for="schedule-subject">Asignatura *</label>
                    <select id="schedule-subject" required>
                        <option value="">Selecciona una asignatura</option>
                    </select>

                    <label for="schedule-day">Día de la semana *</label>
                    <select id="schedule-day" required>
                        ${weekdays.map(day => `
                            <option value="${day.value}">${day.label}</option>
                        `).join('')}
                    </select>

                    <div class="schedule-time-fields">
                        <div>
                            <label for="schedule-start">Hora de inicio *</label>
                            <input type="time" id="schedule-start" required>
                        </div>

                        <div>
                            <label for="schedule-end">Hora de término *</label>
                            <input type="time" id="schedule-end" required>
                        </div>
                    </div>

                    <label for="schedule-classroom">Sala o lugar</label>
                    <input id="schedule-classroom" maxlength="100"
                        placeholder="Ej. Sala 204">

                    <label for="schedule-modality">Modalidad</label>
                    <select id="schedule-modality">
                        <option value="in_person">Presencial</option>
                        <option value="online">Online</option>
                        <option value="hybrid">Híbrida</option>
                    </select>

                    <label for="schedule-teacher">Docente</label>
                    <input id="schedule-teacher" maxlength="100"
                        placeholder="Nombre del docente">

                    <div class="schedule-validity-fields">
                        <div>
                            <label for="schedule-valid-from">Vigente desde</label>
                            <input type="date" id="schedule-valid-from">
                        </div>

                        <div>
                            <label for="schedule-valid-until">Vigente hasta</label>
                            <input type="date" id="schedule-valid-until">
                        </div>
                    </div>

                    <div id="schedule-error" class="schedule-error"
                        role="alert"></div>

                    <div class="schedule-modal-actions">
                        <button type="button" id="schedule-cancel">
                            Cancelar
                        </button>

                        <button type="submit" id="schedule-save"
                            class="schedule-primary-button">
                            Guardar horario
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    bindScheduleEvents();
    await loadScheduleData();
}

async function loadScheduleData() {
    const list = document.getElementById('schedule-list');

    try {
        const { data: subjectData, error: subjectError } = await supabase
            .from('subjects')
            .select('id, name, code, color')
            .order('name', { ascending: true });

        if (subjectError) throw subjectError;

        subjects = subjectData || [];

        const { data: scheduleData, error: scheduleError } = await supabase
            .from('class_schedules')
            .select('*')
            .order('weekday', { ascending: true })
            .order('start_time', { ascending: true });

        if (scheduleError) throw scheduleError;

        schedules = scheduleData || [];

        populateSubjectOptions();
        renderScheduleCalendar();

    } catch (error) {
        console.error('Error cargando horario:', error);

        list.innerHTML = `
            <div class="schedule-empty">
                <h3>No fue posible cargar tu horario</h3>
                <p>${escapeHTML(error.message)}</p>
                <button id="schedule-retry"
                    class="schedule-primary-button">Reintentar</button>
            </div>
        `;

        document.getElementById('schedule-retry')
            ?.addEventListener('click', loadScheduleData);
    }
}

function populateSubjectOptions(selectedId = '') {
    const select = document.getElementById('schedule-subject');

    if (!select) return;

    if (!subjects.length) {
        select.innerHTML = `
            <option value="">Primero debes inscribir una asignatura</option>
        `;
        return;
    }

    select.innerHTML = `
        <option value="">Selecciona una asignatura</option>
        ${subjects.map(subject => `
            <option value="${escapeHTML(subject.id)}"
                ${subject.id === selectedId ? 'selected' : ''}>
                ${escapeHTML(subject.name)}
                ${subject.code ? ` (${escapeHTML(subject.code)})` : ''}
            </option>
        `).join('')}
    `;
}


function renderScheduleCalendar() {
    const list = document.getElementById('schedule-list');

    if (!list) return;

    // Fecha actual en formato local YYYY-MM-DD
    const now = new Date();
    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');

    // Mostrar únicamente horarios activos y vigentes
    const activeSchedules = schedules.filter(item => {
        if (!item.is_active) return false;

        if (item.valid_from && item.valid_from > today) {
            return false;
        }

        if (item.valid_until && item.valid_until < today) {
            return false;
        }

        return true;
    });

    document.getElementById('schedule-total').textContent =
        activeSchedules.length;

    const subjectIds = new Set(
        activeSchedules.map(item => item.subject_id)
    );

    document.getElementById('schedule-subject-total').textContent =
        subjectIds.size;

    if (!subjects.length) {
        list.innerHTML = `
            <div class="schedule-empty">
                <div class="schedule-empty-icon">▦</div>
                <h3>Primero registra tus asignaturas</h3>
                <p>Para crear un horario necesitas tener asignaturas
                inscritas en Mis asignaturas.</p>
            </div>
        `;
        return;
    }

    if (!activeSchedules.length) {
        list.innerHTML = `
            <div class="schedule-empty">
                <div class="schedule-empty-icon">▦</div>
                <h3>Tu horario está vacío</h3>
                <p>No tienes clases vigentes registradas.
                Puedes agregar tus primeras clases.</p>
                <button id="schedule-empty-new"
                    class="schedule-primary-button">
                    + Agregar primera clase
                </button>
            </div>
        `;

        document.getElementById('schedule-empty-new')
            ?.addEventListener('click', openNewSchedule);

        return;
    }

    list.innerHTML = weekdays.map(day => {
        const daySchedules = activeSchedules
            .filter(item => Number(item.weekday) === day.value)
            .sort((a, b) => formatTime(a.start_time)
                .localeCompare(formatTime(b.start_time)));

        return `
            <section class="schedule-day">
                <header class="schedule-day-header">
                    <h3>${day.label}</h3>
                    <span>${daySchedules.length}
                        ${daySchedules.length === 1 ? 'clase' : 'clases'}
                    </span>
                </header>

                <div class="schedule-day-content">
                    ${daySchedules.length
                        ? daySchedules.map(item => {
                            const subject = getSubject(item.subject_id);

                            if (!subject) return '';

                            return `
                                <article class="schedule-class-card"
                                    style="--schedule-color:${escapeHTML(subject.color || '#4F46E5')}">

                                    <div class="schedule-class-time">
                                        ${formatTime(item.start_time)}
                                        – ${formatTime(item.end_time)}
                                    </div>

                                    <div class="schedule-class-info">
                                        <strong>${escapeHTML(subject.name)}</strong>

                                        <span>
                                            ${escapeHTML(
                                                modalityLabels[item.modality]
                                                || 'Sin modalidad'
                                            )}
                                            ${item.classroom
                                                ? ` · ${escapeHTML(item.classroom)}`
                                                : ''}
                                        </span>

                                        ${item.teacher ? `
                                            <small>
                                                Docente: ${escapeHTML(item.teacher)}
                                            </small>
                                        ` : ''}
                                    </div>

                                    <div class="schedule-card-actions">
                                        <button type="button"
                                            class="schedule-edit-button"
                                            data-edit="${escapeHTML(item.id)}"
                                            aria-label="Editar clase"
                                            title="Editar clase">
                                            ✎
                                        </button>

                                        <button type="button"
                                            class="schedule-delete-button"
                                            data-delete="${escapeHTML(item.id)}"
                                            aria-label="Eliminar clase"
                                            title="Eliminar clase">
                                            🗑
                                        </button>
                                    </div>
                                </article>
                            `;
                        }).join('')
                        : '<p class="schedule-no-classes">Sin clases registradas</p>'
                    }
                </div>
            </section>
        `;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
            editSchedule(button.dataset.edit);
        });
    });

    list.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
            deleteSchedule(button.dataset.delete);
        });
    });
}

    if (!activeSchedules.length) {
        list.innerHTML = `
            <div class="schedule-empty">
                <div class="schedule-empty-icon">▦</div>
                <h3>Tu horario está vacío</h3>
                <p>Agrega tus primeras clases para comenzar a organizar
                tu semana académica.</p>
                <button id="schedule-empty-new"
                    class="schedule-primary-button">
                    + Agregar primera clase
                </button>
            </div>
        `;

        document.getElementById('schedule-empty-new')
            ?.addEventListener('click', openNewSchedule);

        return;
    }

    list.innerHTML = weekdays.map(day => {
        const daySchedules = activeSchedules
            .filter(item => Number(item.weekday) === day.value)
            .sort((a, b) => formatTime(a.start_time)
                .localeCompare(formatTime(b.start_time)));

        return `
            <section class="schedule-day">
                <header class="schedule-day-header">
                    <h3>${day.label}</h3>
                    <span>${daySchedules.length}
                        ${daySchedules.length === 1 ? 'clase' : 'clases'}
                    </span>
                </header>

                <div class="schedule-day-content">
                    ${daySchedules.length
                        ? daySchedules.map(item => {
                            const subject = getSubject(item.subject_id);

                            if (!subject) return '';

                            return `
                                <article class="schedule-class-card"
                                    style="--schedule-color:${escapeHTML(subject.color || '#4F46E5')}"
                                    data-edit="${escapeHTML(item.id)}">

                                    <div class="schedule-class-time">
                                        ${formatTime(item.start_time)}
                                        – ${formatTime(item.end_time)}
                                    </div>

                                    <div class="schedule-class-info">
                                        <strong>${escapeHTML(subject.name)}</strong>

                                        <span>
                                            ${escapeHTML(
                                                modalityLabels[item.modality]
                                                || 'Sin modalidad'
                                            )}
                                            ${item.classroom
                                                ? ` · ${escapeHTML(item.classroom)}`
                                                : ''}
                                        </span>

                                        ${item.teacher ? `
                                            <small>
                                                Docente: ${escapeHTML(item.teacher)}
                                            </small>
                                        ` : ''}
                                    </div>

                                    <button type="button"
                                        class="schedule-edit-button"
                                        data-edit="${escapeHTML(item.id)}"
                                        aria-label="Editar clase">
                                        ✎
                                    </button>
                                </article>
                            `;
                        }).join('')
                        : '<p class="schedule-no-classes">Sin clases registradas</p>'
                    }
                </div>
            </section>
        `;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(element => {
        element.addEventListener('click', event => {
            event.stopPropagation();
            editSchedule(element.dataset.edit);
        });
    });
}

function bindScheduleEvents() {
    document.getElementById('schedule-new')
        ?.addEventListener('click', openNewSchedule);

    document.getElementById('schedule-close')
        ?.addEventListener('click', closeScheduleModal);

    document.getElementById('schedule-cancel')
        ?.addEventListener('click', closeScheduleModal);

    document.getElementById('schedule-form')
        ?.addEventListener('submit', saveSchedule);
}

function openNewSchedule() {
    if (!subjects.length) {
        alert('Primero debes registrar una asignatura en Mis asignaturas.');
        return;
    }

    editingScheduleId = null;

    document.getElementById('schedule-form').reset();
    populateSubjectOptions();

    document.getElementById('schedule-modal-title').textContent =
        'Agregar clase';

    document.getElementById('schedule-save').textContent =
        'Guardar horario';

    document.getElementById('schedule-error').textContent = '';
    document.getElementById('schedule-modal').hidden = false;
}

function editSchedule(id) {
    const item = schedules.find(schedule => schedule.id === id);

    if (!item) return;

    editingScheduleId = id;

    populateSubjectOptions(item.subject_id);

    document.getElementById('schedule-day').value = item.weekday;
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

    document.getElementById('schedule-save').textContent =
        'Guardar cambios';

    document.getElementById('schedule-error').textContent = '';
    document.getElementById('schedule-modal').hidden = false;
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').hidden = true;
    editingScheduleId = null;
}

function hasScheduleConflict(day, start, end, validFrom, validUntil) {
    return schedules.some(item => {
        if (!item.is_active || item.id === editingScheduleId) {
            return false;
        }

        if (Number(item.weekday) !== Number(day)) {
            return false;
        }

        const existingStart = formatTime(item.start_time);
        const existingEnd = formatTime(item.end_time);

        const timeOverlaps = start < existingEnd && end > existingStart;

        if (!timeOverlaps) return false;

        const newStartDate = validFrom || '0001-01-01';
        const newEndDate = validUntil || '9999-12-31';
        const oldStartDate = item.valid_from || '0001-01-01';
        const oldEndDate = item.valid_until || '9999-12-31';

        const datesOverlap =
            newStartDate <= oldEndDate && newEndDate >= oldStartDate;

        return datesOverlap;
    });
}

async function saveSchedule(event) {
    event.preventDefault();

    const saveButton = document.getElementById('schedule-save');
    const errorContainer = document.getElementById('schedule-error');

    const subjectId = document.getElementById('schedule-subject').value;
    const weekday = Number(document.getElementById('schedule-day').value);
    const startTime = document.getElementById('schedule-start').value;
    const endTime = document.getElementById('schedule-end').value;

    const validFrom =
        document.getElementById('schedule-valid-from').value || null;

    const validUntil =
        document.getElementById('schedule-valid-until').value || null;

    if (!subjectId) {
        errorContainer.textContent =
            'Debes seleccionar una asignatura inscrita.';
        return;
    }

    if (!getSubject(subjectId)) {
        errorContainer.textContent =
            'La asignatura seleccionada no está disponible.';
        return;
    }

    if (!startTime || !endTime || endTime <= startTime) {
        errorContainer.textContent =
            'La hora de término debe ser posterior a la hora de inicio.';
        return;
    }

    if (validFrom && validUntil && validUntil < validFrom) {
        errorContainer.textContent =
            'La fecha de término no puede ser anterior a la fecha de inicio.';
        return;
    }

    if (hasScheduleConflict(
        weekday,
        startTime,
        endTime,
        validFrom,
        validUntil
    )) {
        errorContainer.textContent =
            'Este horario se cruza con otra clase registrada ese día.';
        return;
    }

    const wasEditing = Boolean(editingScheduleId);
    const scheduleId = editingScheduleId;

    saveButton.disabled = true;
    saveButton.textContent = 'Guardando...';
    errorContainer.textContent = '';

    try {
        const { data: userData, error: userError } =
            await supabase.auth.getUser();

        if (userError) throw userError;

        if (!userData.user) {
            throw new Error(
                'No existe una sesión activa. Inicia sesión nuevamente.'
            );
        }

        const payload = {
            user_id: userData.user.id,
            subject_id: subjectId,
            weekday,
            start_time: startTime,
            end_time: endTime,
            classroom:
                document.getElementById('schedule-classroom').value.trim()
                || null,
            modality:
                document.getElementById('schedule-modality').value,
            teacher:
                document.getElementById('schedule-teacher').value.trim()
                || null,
            valid_from: validFrom,
            valid_until: validUntil,
            is_active: true
        };

        let result;

        if (wasEditing) {
            result = await supabase
                .from('class_schedules')
                .update(payload)
                .eq('id', scheduleId);
        } else {
            result = await supabase
                .from('class_schedules')
                .insert(payload);
        }

        if (result.error) throw result.error;

        closeScheduleModal();
        await loadScheduleData();

    } catch (error) {
        console.error('Error guardando horario:', error);
        errorContainer.textContent =
            error.message || 'No fue posible guardar el horario.';

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = wasEditing
            ? 'Guardar cambios'
            : 'Guardar horario';
    }
}

async function deleteSchedule(id) {
    const item = schedules.find(schedule => schedule.id === id);

    if (!item) return;

    const subject = getSubject(item.subject_id);

    const confirmed = confirm(
        `¿Eliminar la clase de ${subject?.name || 'esta asignatura'} ` +
        `del día ${getDayName(item.weekday)}?`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('class_schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadScheduleData();

    } catch (error) {
        console.error('Error eliminando horario:', error);
        alert('No fue posible eliminar el horario: ' + error.message);
    }
}
