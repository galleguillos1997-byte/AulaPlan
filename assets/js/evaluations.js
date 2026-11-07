
import { supabase } from './config.js';

// ======================================================
// AULAPLAN - EVALUACIONES Y TAREAS
// ======================================================

let currentUser = null;
let subjects = [];
let activities = [];
let activeTab = 'grades';
let editingActivityId = null;
let selectedSubjectId = null;

const PASSING_GRADE_DEFAULT = 4.0;

const GRADE_TYPES = [
    { value: 'quiz', label: 'Quiz' },
    { value: 'control', label: 'Prueba / Control' },
    { value: 'workshop', label: 'Taller' },
    { value: 'assignment', label: 'Trabajo' },
    { value: 'presentation', label: 'Presentación' },
    { value: 'report', label: 'Informe' },
    { value: 'exam', label: 'Examen' }
];

const CALENDAR_TYPES = [
    ...GRADE_TYPES,
    { value: 'task', label: 'Tarea' },
    { value: 'reading', label: 'Lectura' },
    { value: 'other', label: 'Otro' }
];

// ======================================================
// INICIO DEL MÓDULO
// ======================================================

export async function renderEvaluationsUI() {
    const container = document.getElementById('dashboard-view-content');

    if (!container) {
        console.error('No se encontró dashboard-view-content.');
        return;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        container.innerHTML = `
            <div class="evaluations-empty">
                No fue posible identificar tu sesión.
            </div>
        `;
        return;
    }

    currentUser = data.user;

    container.innerHTML = `
        <section class="evaluations-page">

            <header class="evaluations-header">
                <div>
                    <span class="evaluations-eyebrow">
                        ORGANIZACIÓN ACADÉMICA
                    </span>

                    <h1>Evaluaciones y tareas</h1>

                    <p>
                        Controla tus notas, ponderaciones y próximos
                        compromisos académicos.
                    </p>
                </div>
            </header>

            <nav class="evaluations-tabs">
                <button
                    type="button"
                    class="evaluations-tab active"
                    data-tab="grades">
                    <i class="fa-solid fa-calculator"></i>
                    Notas y ponderaciones
                </button>

                <button
                    type="button"
                    class="evaluations-tab"
                    data-tab="calendar">
                    <i class="fa-regular fa-calendar-days"></i>
                    Calendario
                </button>
            </nav>

            <div id="evaluations-content">
                <div class="evaluations-loading">
                    Cargando información académica...
                </div>
            </div>

        </section>

        <div id="evaluation-modal" class="evaluation-modal" hidden></div>
        <div id="subject-settings-modal" class="evaluation-modal" hidden></div>
    `;

    bindMainEvents();
    await loadData();
}

// ======================================================
// CARGA DE DATOS
// ======================================================

async function loadData() {
    const container = document.getElementById('evaluations-content');

    try {
        const [subjectsResult, activitiesResult] = await Promise.all([
            supabase
                .from('subjects')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('name', { ascending: true }),

            supabase
                .from('activities')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('due_at', { ascending: true, nullsFirst: false })
        ]);

        if (subjectsResult.error) throw subjectsResult.error;
        if (activitiesResult.error) throw activitiesResult.error;

        subjects = subjectsResult.data || [];
        activities = activitiesResult.data || [];

        renderActiveTab();

    } catch (error) {
        console.error('Error cargando evaluaciones:', error);

        container.innerHTML = `
            <div class="evaluations-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h3>No fue posible cargar la información</h3>
                <p>${escapeHTML(error.message)}</p>

                <button type="button" id="evaluation-retry">
                    Reintentar
                </button>
            </div>
        `;

        document
            .getElementById('evaluation-retry')
            ?.addEventListener('click', loadData);
    }
}

// ======================================================
// EVENTOS PRINCIPALES
// ======================================================

function bindMainEvents() {
    document.querySelectorAll('.evaluations-tab').forEach(button => {
        button.addEventListener('click', () => {
            activeTab = button.dataset.tab;

            document.querySelectorAll('.evaluations-tab').forEach(tab => {
                tab.classList.toggle('active', tab === button);
            });

            renderActiveTab();
        });
    });
}

function renderActiveTab() {
    if (activeTab === 'calendar') {
        renderCalendar();
    } else {
        renderGrades();
    }
}

// ======================================================
// VISTA DE NOTAS
// ======================================================

function renderGrades() {
    const container = document.getElementById('evaluations-content');

    if (!subjects.length) {
        container.innerHTML = `
            <div class="evaluations-empty">
                <div class="evaluations-empty-icon">
                    <i class="fa-solid fa-book-open"></i>
                </div>

                <h2>Aún no tienes asignaturas</h2>

                <p>
                    Primero registra tus asignaturas para comenzar
                    a gestionar tus evaluaciones.
                </p>

                <button type="button" id="go-subjects">
                    Ir a mis asignaturas
                </button>
            </div>
        `;

        document.getElementById('go-subjects')?.addEventListener('click', () => {
            document.dispatchEvent(
                new CustomEvent('aulaplan:navigate', {
                    detail: { section: 'subjects' }
                })
            );
        });

        return;
    }

    const totalEvaluations = activities.filter(isGradeEvaluation).length;

    const completedEvaluations = activities.filter(activity =>
        isGradeEvaluation(activity) && activity.grade !== null
    ).length;

    container.innerHTML = `
        <div class="evaluations-overview">

            <div class="evaluation-stat-card">
                <span>Asignaturas</span>
                <strong>${subjects.length}</strong>
                <i class="fa-solid fa-book"></i>
            </div>

            <div class="evaluation-stat-card">
                <span>Evaluaciones registradas</span>
                <strong>${totalEvaluations}</strong>
                <i class="fa-solid fa-file-lines"></i>
            </div>

            <div class="evaluation-stat-card">
                <span>Notas ingresadas</span>
                <strong>${completedEvaluations}</strong>
                <i class="fa-solid fa-check-circle"></i>
            </div>

        </div>

        <div class="evaluations-section-heading">
            <div>
                <h2>Mis asignaturas</h2>
                <p>Administra las notas y ponderaciones de cada ramo.</p>
            </div>
        </div>

        <div class="evaluation-subject-list">
            ${subjects.map(renderSubjectCard).join('')}
        </div>
    `;

    bindGradeEvents();
}

function renderSubjectCard(subject) {
    const subjectActivities = activities.filter(activity =>
        activity.subject_id === subject.id
    );

    const evaluations = subjectActivities.filter(isGradeEvaluation);

    const passingGrade = Number(
        subject.passing_grade ?? PASSING_GRADE_DEFAULT
    );

    const hasExam = subject.has_exam === true;
    const examWeight = hasExam
        ? Number(subject.exam_weight_percentage || 0)
        : 0;

    const presentationWeight = evaluations
        .filter(item => item.activity_type !== 'exam')
        .reduce((sum, item) => sum + Number(item.weight_percentage || 0), 0);

    const targetWeight = 100 - examWeight;
    const remainingWeight = targetWeight - presentationWeight;

    const excessWeight = presentationWeight > targetWeight;

    const examActivity = evaluations.find(
        item => item.activity_type === 'exam'
    );

    const calculation = calculateRequiredGrades(
        subject,
        evaluations
    );

    const color = safeColor(subject.color);

    return `
        <article class="evaluation-subject-card">

            <div class="evaluation-subject-top">
                <div class="evaluation-subject-identity">
                    <span
                        class="evaluation-subject-color"
                        style="background:${color}">
                    </span>

                    <div>
                        <h3>${escapeHTML(subject.name)}</h3>

                        <span>
                            ${subject.code
                                ? escapeHTML(subject.code)
                                : 'Sin código'}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    class="evaluation-settings-button"
                    data-subject-settings="${subject.id}"
                    title="Configurar asignatura">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>

            <div class="evaluation-subject-settings-summary">
                <span>
                    Nota de aprobación:
                    <strong>${formatGrade(passingGrade)}</strong>
                </span>

                <span>
                    Examen:
                    <strong>${hasExam
                        ? `${formatNumber(examWeight)}%`
                        : 'No'}
                    </strong>
                </span>
            </div>

            <div class="evaluation-weight-section">

                <div class="evaluation-weight-header">
                    <span>Ponderación de evaluaciones</span>

                    <strong class="${excessWeight ? 'weight-danger' : ''}">
                        ${formatNumber(presentationWeight)}%
                        / ${formatNumber(targetWeight)}%
                    </strong>
                </div>

                <div class="evaluation-progress-track">
                    <div
                        class="evaluation-progress-fill ${excessWeight ? 'danger' : ''}"
                        style="width:${Math.min(
                            targetWeight > 0
                                ? presentationWeight / targetWeight * 100
                                : 0,
                            100
                        )}%">
                    </div>
                </div>

                <div class="evaluation-weight-footer">
                    <span>
                        ${excessWeight
                            ? `Exceso: ${formatNumber(Math.abs(remainingWeight))}%`
                            : `Falta asignar: ${formatNumber(remainingWeight)}%`}
                    </span>

                    <span>
                        ${evaluations.length} evaluaciones
                    </span>
                </div>
            </div>

            ${renderGradeSummary(calculation, hasExam)}

            <div class="evaluation-table-wrapper">
                ${evaluations.length
                    ? renderEvaluationTable(
                        evaluations,
                        calculation
                    )
                    : `
                        <div class="evaluation-no-items">
                            Todavía no tienes evaluaciones registradas.
                        </div>
                    `}
            </div>

            <div class="evaluation-subject-actions">
                <button
                    type="button"
                    class="evaluation-add-button"
                    data-add-evaluation="${subject.id}">
                    <i class="fa-solid fa-plus"></i>
                    Agregar evaluación
                </button>

                <button
                    type="button"
                    class="evaluation-add-task-button"
                    data-add-task="${subject.id}">
                    <i class="fa-regular fa-calendar-plus"></i>
                    Agregar tarea
                </button>
            </div>

        </article>
    `;
}

function renderGradeSummary(calculation, hasExam) {
    let content = '';

    if (!hasExam) {
        content = `
            <div class="evaluation-required-grade">
                <span>Nota necesaria para aprobar</span>

                <strong class="${gradeStatusClass(calculation.presentationRequired)}">
                    ${formatRequiredGrade(calculation.presentationRequired)}
                </strong>

                <small>
                    Promedio requerido en las evaluaciones pendientes.
                </small>
            </div>
        `;
    } else {
        content = `
            <div class="evaluation-required-grid">

                <div class="evaluation-required-grade">
                    <span>Nota necesaria en evaluaciones pendientes</span>

                    <strong class="${gradeStatusClass(calculation.presentationRequired)}">
                        ${formatRequiredGrade(calculation.presentationRequired)}
                    </strong>

                    <small>
                        Suponiendo que el examen se aprueba con la nota mínima.
                    </small>
                </div>

                <div class="evaluation-required-grade">
                    <span>Nota necesaria en el examen</span>

                    <strong class="${gradeStatusClass(calculation.examRequired)}">
                        ${formatRequiredGrade(calculation.examRequired)}
                    </strong>

                    <small>
                        Suponiendo que las evaluaciones pendientes se aprueban.
                    </small>
                </div>

            </div>
        `;
    }

    return `
        <div class="evaluation-grade-summary">
            ${content}
        </div>
    `;
}

function renderEvaluationTable(evaluations, calculation) {
    const presentationRequired = calculation.presentationRequired;

    return `
        <table class="evaluation-table">
            <thead>
                <tr>
                    <th>Evaluación</th>
                    <th>Fecha</th>
                    <th>Ponderación</th>
                    <th>Nota</th>
                    <th>Nota necesaria</th>
                    <th></th>
                </tr>
            </thead>

            <tbody>
                ${evaluations.map(activity => {
                    const isExam = activity.activity_type === 'exam';

                    const needed = activity.grade !== null
                        ? Number(activity.grade)
                        : isExam
                            ? calculation.examRequired
                            : presentationRequired;

                    return `
                        <tr>
                            <td>
                                <div class="evaluation-name-cell">
                                    <strong>${escapeHTML(activity.title)}</strong>
                                    <small>${getTypeLabel(activity.activity_type)}</small>
                                </div>
                            </td>

                            <td>
                                ${formatDate(activity.due_at)}
                            </td>

                            <td>
                                ${isExam
                                    ? 'Examen'
                                    : `${formatNumber(activity.weight_percentage || 0)}%`}
                            </td>

                            <td>
                                <span class="evaluation-grade-pill ${activity.grade !== null ? 'graded' : 'pending'}">
                                    ${activity.grade !== null
                                        ? formatGrade(activity.grade)
                                        : 'Pendiente'}
                                </span>
                            </td>

                            <td>
                                <strong class="${gradeStatusClass(needed)}">
                                    ${formatRequiredGrade(needed)}
                                </strong>
                            </td>

                            <td>
                                <div class="evaluation-row-actions">
                                    <button
                                        type="button"
                                        data-edit-evaluation="${activity.id}"
                                        title="Editar">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>

                                    <button
                                        type="button"
                                        data-delete-evaluation="${activity.id}"
                                        title="Eliminar">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ======================================================
// CÁLCULOS DE NOTAS
// ======================================================

function calculateRequiredGrades(subject, evaluations) {
    const passing = Number(
        subject.passing_grade ?? PASSING_GRADE_DEFAULT
    );

    const hasExam = subject.has_exam === true;

    const examWeight = hasExam
        ? Number(subject.exam_weight_percentage || 0)
        : 0;

    const presentationEvaluations = evaluations.filter(
        item => item.activity_type !== 'exam'
    );

    const gradedPresentations = presentationEvaluations.filter(
        item => item.grade !== null
    );

    const pendingPresentations = presentationEvaluations.filter(
        item => item.grade === null
    );

    const earnedPresentationPoints = gradedPresentations.reduce(
        (sum, item) =>
            sum + Number(item.grade) * Number(item.weight_percentage || 0),
        0
    );

    const pendingPresentationWeight = pendingPresentations.reduce(
        (sum, item) => sum + Number(item.weight_percentage || 0),
        0
    );

    const examActivity = evaluations.find(
        item => item.activity_type === 'exam'
    );

    const examGrade = examActivity?.grade !== null &&
        examActivity?.grade !== undefined
        ? Number(examActivity.grade)
        : null;

    const examPoints = examGrade !== null
        ? examGrade * examWeight
        : 0;

    let presentationRequired = null;
    let examRequired = null;

    if (!hasExam) {
        if (pendingPresentationWeight > 0) {
            presentationRequired = (
                passing * 100 - earnedPresentationPoints
            ) / pendingPresentationWeight;
        } else {
            presentationRequired = earnedPresentationPoints >= passing * 100
                ? 1
                : null;
        }
    } else {
        if (pendingPresentationWeight > 0) {
            const assumedExamGrade = examGrade !== null
                ? examGrade
                : passing;

            presentationRequired = (
                passing * 100 -
                earnedPresentationPoints -
                assumedExamGrade * examWeight
            ) / pendingPresentationWeight;
        } else {
            presentationRequired = null;
        }

        if (examGrade === null && examWeight > 0) {
            const assumedPendingGrade = passing;

            examRequired = (
                passing * 100 -
                earnedPresentationPoints -
                assumedPendingGrade * pendingPresentationWeight
            ) / examWeight;
        } else if (examGrade !== null) {
            examRequired = examGrade;
        }
    }

    return {
        presentationRequired,
        examRequired,
        earnedPresentationPoints,
        pendingPresentationWeight,
        examWeight,
        examGrade
    };
}

// ======================================================
// EVENTOS DE LA VISTA DE NOTAS
// ======================================================

function bindGradeEvents() {
    document.querySelectorAll('[data-add-evaluation]').forEach(button => {
        button.addEventListener('click', () => {
            openEvaluationModal(button.dataset.addEvaluation);
        });
    });

    document.querySelectorAll('[data-add-task]').forEach(button => {
        button.addEventListener('click', () => {
            openTaskModal(button.dataset.addTask);
        });
    });

    document.querySelectorAll('[data-subject-settings]').forEach(button => {
        button.addEventListener('click', () => {
            openSubjectSettings(button.dataset.subjectSettings);
        });
    });

    document.querySelectorAll('[data-edit-evaluation]').forEach(button => {
        button.addEventListener('click', () => {
            editActivity(button.dataset.editEvaluation);
        });
    });

    document.querySelectorAll('[data-delete-evaluation]').forEach(button => {
        button.addEventListener('click', () => {
            deleteActivity(button.dataset.deleteEvaluation);
        });
    });
}

// ======================================================
// CONFIGURACIÓN DE ASIGNATURA
// ======================================================

function openSubjectSettings(subjectId) {
    const subject = subjects.find(item => item.id === subjectId);

    if (!subject) return;

    selectedSubjectId = subjectId;

    const modal = document.getElementById('subject-settings-modal');

    modal.innerHTML = `
        <div class="evaluation-modal-backdrop">
            <div class="evaluation-modal-content">

                <div class="evaluation-modal-header">
                    <div>
                        <span>CONFIGURACIÓN</span>
                        <h2>${escapeHTML(subject.name)}</h2>
                    </div>

                    <button type="button" data-close-settings>
                        ✕
                    </button>
                </div>

                <form id="subject-settings-form">

                    <label>
                        Nota mínima de aprobación
                        <input
                            type="number"
                            name="passing_grade"
                            min="1"
                            max="7"
                            step="0.1"
                            value="${Number(subject.passing_grade ?? 4).toFixed(1)}"
                            required>
                    </label>

                    <div class="evaluation-exam-toggle">
                        <label>
                            <input
                                type="checkbox"
                                name="has_exam"
                                ${subject.has_exam ? 'checked' : ''}>
                            Esta asignatura tiene examen
                        </label>
                    </div>

                    <div id="exam-weight-field">
                        <label>
                            Ponderación del examen (%)
                            <input
                                type="number"
                                name="exam_weight_percentage"
                                min="1"
                                max="100"
                                step="0.5"
                                value="${subject.exam_weight_percentage || 30}">
                        </label>

                        <small>
                            Las evaluaciones de presentación deberán sumar
                            ${subject.has_exam
                                ? 100 - Number(subject.exam_weight_percentage || 0)
                                : 100}%.
                        </small>
                    </div>

                    <div class="evaluation-modal-actions">
                        <button type="button" data-close-settings>
                            Cancelar
                        </button>

                        <button type="submit">
                            Guardar configuración
                        </button>
                    </div>

                </form>

            </div>
        </div>
    `;

    modal.hidden = false;

    const form = document.getElementById('subject-settings-form');
    const examToggle = form.elements.has_exam;
    const examField = document.getElementById('exam-weight-field');
    const examWeightInput = form.elements.exam_weight_percentage;

    function updateExamField() {
        examField.style.display = examToggle.checked ? 'block' : 'none';
        examWeightInput.required = examToggle.checked;
    }

    examToggle.addEventListener('change', updateExamField);

    modal.querySelectorAll('[data-close-settings]').forEach(button => {
        button.addEventListener('click', closeSettingsModal);
    });

    updateExamField();

    form.addEventListener('submit', saveSubjectSettings);
}

async function saveSubjectSettings(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const passingGrade = Number(formData.get('passing_grade'));
    const hasExam = form.elements.has_exam.checked;
    const examWeight = hasExam
        ? Number(formData.get('exam_weight_percentage'))
        : null;

    if (
        !Number.isFinite(passingGrade) ||
        passingGrade < 1 ||
        passingGrade > 7
    ) {
        alert('La nota de aprobación debe estar entre 1.0 y 7.0.');
        return;
    }

    if (
        hasExam &&
        (!Number.isFinite(examWeight) || examWeight <= 0 || examWeight > 100)
    ) {
        alert('La ponderación del examen debe ser mayor a 0 y no superar 100%.');
        return;
    }

    const subjectEvaluations = activities.filter(activity =>
        activity.subject_id === selectedSubjectId &&
        isGradeEvaluation(activity) &&
        activity.activity_type !== 'exam'
    );

    const currentWeight = subjectEvaluations.reduce(
        (sum, item) => sum + Number(item.weight_percentage || 0),
        0
    );

    const targetWeight = hasExam ? 100 - examWeight : 100;

    if (currentWeight > targetWeight + 0.001) {
        alert(
            `Las evaluaciones actuales suman ${formatNumber(currentWeight)}%. ` +
            `La ponderación máxima permitida es ${formatNumber(targetWeight)}%. ` +
            'Ajusta las ponderaciones antes de guardar.'
        );
        return;
    }

    const { error } = await supabase
        .from('subjects')
        .update({
            passing_grade: passingGrade,
            has_exam: hasExam,
            exam_weight_percentage: examWeight
        })
        .eq('id', selectedSubjectId)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        alert('No fue posible guardar la configuración.');
        return;
    }

    closeSettingsModal();
    await loadData();
}

function closeSettingsModal() {
    const modal = document.getElementById('subject-settings-modal');

    if (modal) {
        modal.hidden = true;
        modal.innerHTML = '';
    }

    selectedSubjectId = null;
}

// ======================================================
// FORMULARIO DE EVALUACIONES
// ======================================================

function openEvaluationModal(subjectId, activity = null) {
    const subject = subjects.find(item => item.id === subjectId);

    if (!subject) return;

    editingActivityId = activity?.id || null;
    selectedSubjectId = subjectId;

    const modal = document.getElementById('evaluation-modal');

    const evaluationTypes = GRADE_TYPES.filter(type =>
        type.value !== 'exam' || subject.has_exam
    );

    const activityType = activity?.activity_type || 'control';

    modal.innerHTML = `
        <div class="evaluation-modal-backdrop">
            <div class="evaluation-modal-content">

                <div class="evaluation-modal-header">
                    <div>
                        <span>${activity ? 'EDITAR REGISTRO' : 'NUEVA EVALUACIÓN'}</span>
                        <h2>${activity ? 'Editar evaluación' : 'Agregar evaluación'}</h2>
                        <p>${escapeHTML(subject.name)}</p>
                    </div>

                    <button type="button" data-close-evaluation>
                        ✕
                    </button>
                </div>

                <form id="evaluation-form">

                    <label>
                        Nombre de la evaluación
                        <input
                            type="text"
                            name="title"
                            maxlength="150"
                            placeholder="Ej. Control unidad 1"
                            value="${escapeHTML(activity?.title || '')}"
                            required>
                    </label>

                    <div class="evaluation-form-grid">

                        <label>
                            Tipo de evaluación
                            <select name="activity_type" required>
                                ${evaluationTypes.map(type => `
                                    <option
                                        value="${type.value}"
                                        ${activityType === type.value ? 'selected' : ''}>
                                        ${type.label}
                                    </option>
                                `).join('')}
                            </select>
                        </label>

                        <label>
                            Ponderación (%)
                            <input
                                type="number"
                                name="weight_percentage"
                                min="0"
                                max="100"
                                step="0.5"
                                value="${activity?.weight_percentage ?? ''}"
                                placeholder="Ej. 20">
                        </label>

                    </div>

                    <div class="evaluation-form-grid">

                        <label>
                            Nota obtenida
                            <input
                                type="number"
                                name="grade"
                                min="1"
                                max="7"
                                step="0.1"
                                value="${activity?.grade ?? ''}"
                                placeholder="Ej. 5.5">
                        </label>

                        <label>
                            Fecha de evaluación
                            <input
                                type="date"
                                name="due_date"
                                value="${toDateInput(activity?.due_at)}">
                        </label>

                    </div>

                    <label>
                        Descripción (opcional)
                        <textarea
                            name="description"
                            rows="3"
                            placeholder="Detalles o contenidos de la evaluación">${escapeHTML(activity?.description || '')}</textarea>
                    </label>

                    <div class="evaluation-modal-actions">
                        <button type="button" data-close-evaluation>
                            Cancelar
                        </button>

                        <button type="submit">
                            ${activity ? 'Guardar cambios' : 'Guardar evaluación'}
                        </button>
                    </div>

                </form>

            </div>
        </div>
    `;

    modal.hidden = false;

    modal.querySelectorAll('[data-close-evaluation]').forEach(button => {
        button.addEventListener('click', closeEvaluationModal);
    });

    document
        .getElementById('evaluation-form')
        .addEventListener('submit', saveEvaluation);
}

async function saveEvaluation(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const title = String(formData.get('title') || '').trim();
    const type = String(formData.get('activity_type') || '');
    const weightRaw = formData.get('weight_percentage');
    const gradeRaw = formData.get('grade');
    const dueDate = formData.get('due_date');
    const description = String(formData.get('description') || '').trim();

    const weight = weightRaw === '' ? null : Number(weightRaw);
    const grade = gradeRaw === '' ? null : Number(gradeRaw);

    if (!title) {
        alert('Ingresa el nombre de la evaluación.');
        return;
    }

    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) {
        alert('La ponderación debe estar entre 0 y 100%.');
        return;
    }

    if (grade !== null && (!Number.isFinite(grade) || grade < 1 || grade > 7)) {
        alert('La nota debe estar entre 1.0 y 7.0.');
        return;
    }

    const subject = subjects.find(item => item.id === selectedSubjectId);

    if (!subject) return;

    const isExam = type === 'exam';

    if (isExam && !subject.has_exam) {
        alert('Primero activa el examen en la configuración de la asignatura.');
        return;
    }

    const existingExam = activities.find(item =>
        item.subject_id === selectedSubjectId &&
        item.activity_type === 'exam' &&
        item.id !== editingActivityId
    );

    if (isExam && existingExam) {
        alert('Ya existe un examen registrado para esta asignatura. Edita el existente.');
        return;
    }

    if (!isExam && weight !== null) {
        const otherEvaluations = activities.filter(item =>
            item.subject_id === selectedSubjectId &&
            isGradeEvaluation(item) &&
            item.activity_type !== 'exam' &&
            item.id !== editingActivityId
        );

        const assignedWeight = otherEvaluations.reduce(
            (sum, item) => sum + Number(item.weight_percentage || 0),
            0
        );

        const examWeight = subject.has_exam
            ? Number(subject.exam_weight_percentage || 0)
            : 0;

        const maxWeight = 100 - examWeight;

        if (assignedWeight + weight > maxWeight + 0.001) {
            alert(
                `La ponderación supera el máximo permitido. ` +
                `Puedes asignar hasta ${formatNumber(maxWeight - assignedWeight)}% adicional.`
            );
            return;
        }
    }

    const dueAt = dueDate
        ? new Date(`${dueDate}T12:00:00`).toISOString()
        : null;

    const payload = {
        user_id: currentUser.id,
        subject_id: selectedSubjectId,
        title,
        description: description || null,
        activity_type: type,
        due_at: dueAt,
        weight_percentage: isExam ? null : weight,
        grade,
        priority: 'medium',
        status: 'pending'
    };

    let result;

    if (editingActivityId) {
        result = await supabase
            .from('activities')
            .update(payload)
            .eq('id', editingActivityId)
            .eq('user_id', currentUser.id);
    } else {
        result = await supabase
            .from('activities')
            .insert(payload);
    }

    if (result.error) {
        console.error('Error guardando evaluación:', result.error);
        alert('No fue posible guardar la evaluación. Revisa tu conexión.');
        return;
    }

    closeEvaluationModal();
    await loadData();
}

function editActivity(activityId) {
    const activity = activities.find(item => item.id === activityId);

    if (!activity) return;

    if (activity.activity_type === 'task' ||
        activity.activity_type === 'reading' ||
        activity.activity_type === 'other') {
        openTaskModal(activity.subject_id, activity);
        return;
    }

    openEvaluationModal(activity.subject_id, activity);
}

async function deleteActivity(activityId) {
    const activity = activities.find(item => item.id === activityId);

    if (!activity) return;

    const confirmed = confirm(
        `¿Eliminar "${activity.title}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        alert('No fue posible eliminar el registro.');
        return;
    }

    await loadData();
}

function closeEvaluationModal() {
    const modal = document.getElementById('evaluation-modal');

    if (modal) {
        modal.hidden = true;
        modal.innerHTML = '';
    }

    editingActivityId = null;
    selectedSubjectId = null;
}

// ======================================================
// TAREAS
// ======================================================

function openTaskModal(subjectId, activity = null) {
    const subject = subjects.find(item => item.id === subjectId);

    if (!subject) return;

    editingActivityId = activity?.id || null;
    selectedSubjectId = subjectId;

    const modal = document.getElementById('evaluation-modal');

    modal.innerHTML = `
        <div class="evaluation-modal-backdrop">
            <div class="evaluation-modal-content">

                <div class="evaluation-modal-header">
                    <div>
                        <span>${activity ? 'EDITAR TAREA' : 'NUEVA TAREA'}</span>
                        <h2>${activity ? 'Editar tarea' : 'Agregar tarea'}</h2>
                        <p>${escapeHTML(subject.name)}</p>
                    </div>

                    <button type="button" data-close-evaluation>✕</button>
                </div>

                <form id="task-form">

                    <label>
                        Nombre de la tarea
                        <input
                            type="text"
                            name="title"
                            maxlength="150"
                            value="${escapeHTML(activity?.title || '')}"
                            placeholder="Ej. Entrega de informe"
                            required>
                    </label>

                    <label>
                        Tipo
                        <select name="activity_type">
                            ${CALENDAR_TYPES.filter(type =>
                                !['quiz', 'control', 'workshop', 'assignment', 'presentation', 'report', 'exam'].includes(type.value)
                            ).map(type => `
                                <option
                                    value="${type.value}"
                                    ${activity?.activity_type === type.value ? 'selected' : ''}>
                                    ${type.label}
                                </option>
                            `).join('')}
                        </select>
                    </label>

                    <label>
                        Fecha de entrega
                        <input
                            type="date"
                            name="due_date"
                            value="${toDateInput(activity?.due_at)}">
                    </label>

                    <label>
                        Descripción (opcional)
                        <textarea
                            name="description"
                            rows="3">${escapeHTML(activity?.description || '')}</textarea>
                    </label>

                    <div class="evaluation-modal-actions">
                        <button type="button" data-close-evaluation>
                            Cancelar
                        </button>

                        <button type="submit">
                            Guardar tarea
                        </button>
                    </div>

                </form>

            </div>
        </div>
    `;

    modal.hidden = false;

    modal.querySelectorAll('[data-close-evaluation]').forEach(button => {
        button.addEventListener('click', closeEvaluationModal);
    });

    document
        .getElementById('task-form')
        .addEventListener('submit', saveTask);
}

async function saveTask(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const title = String(formData.get('title') || '').trim();
    const type = String(formData.get('activity_type') || 'task');
    const dueDate = formData.get('due_date');
    const description = String(formData.get('description') || '').trim();

    if (!title) {
        alert('Ingresa el nombre de la tarea.');
        return;
    }

    const dueAt = dueDate
        ? new Date(`${dueDate}T12:00:00`).toISOString()
        : null;

    const payload = {
        user_id: currentUser.id,
        subject_id: selectedSubjectId,
        title,
        description: description || null,
        activity_type: type,
        due_at: dueAt,
        weight_percentage: null,
        priority: 'medium',
        status: 'pending'
    };

    let result;

    if (editingActivityId) {
        result = await supabase
            .from('activities')
            .update(payload)
            .eq('id', editingActivityId)
            .eq('user_id', currentUser.id);
    } else {
        result = await supabase
            .from('activities')
            .insert(payload);
    }

    if (result.error) {
        console.error(result.error);
        alert('No fue posible guardar la tarea.');
        return;
    }

    closeEvaluationModal();
    await loadData();
}

// ======================================================
// CALENDARIO
// ======================================================

function renderCalendar() {
    const container = document.getElementById('evaluations-content');

    const datedActivities = activities
        .filter(item => item.due_at)
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [calendarYear, calendarMonth] = [
        monthStart.getFullYear(),
        monthStart.getMonth()
    ];

    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const calendarCells = [];

    for (let i = 0; i < startOffset; i++) {
        calendarCells.push('<div class="calendar-day empty"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = [
            calendarYear,
            String(calendarMonth + 1).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');

        const dayActivities = datedActivities.filter(item =>
            toDateInput(item.due_at) === dateKey
        );

        calendarCells.push(`
            <div class="calendar-day ${dayActivities.length ? 'has-events' : ''}">
                <span class="calendar-day-number">${day}</span>

                <div class="calendar-day-events">
                    ${dayActivities.slice(0, 3).map(item => `
                        <div
                            class="calendar-event ${isGradeEvaluation(item) ? 'event-evaluation' : 'event-task'}"
                            title="${escapeHTML(item.title)}">
                            ${escapeHTML(item.title)}
                        </div>
                    `).join('')}

                    ${dayActivities.length > 3
                        ? `<small>+${dayActivities.length - 3} más</small>`
                        : ''}
                </div>
            </div>
        `);
    }

    const monthLabel = new Intl.DateTimeFormat('es-CL', {
        month: 'long',
        year: 'numeric'
    }).format(today);

    container.innerHTML = `
        <div class="evaluation-calendar-layout">

            <section class="evaluation-calendar-main">

                <div class="evaluation-calendar-header">
                    <div>
                        <h2>${capitalize(monthLabel)}</h2>
                        <p>Fechas importantes de tu vida académica.</p>
                    </div>

                    <span class="calendar-current-month">
                        ${datedActivities.length} registros con fecha
                    </span>
                </div>

                <div class="evaluation-calendar-grid">

                    ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
                        .map(day => `
                            <div class="calendar-weekday">${day}</div>
                        `).join('')}

                    ${calendarCells.join('')}

                </div>

                <div class="evaluation-calendar-legend">
                    <span><i class="legend-evaluation"></i> Evaluación</span>
                    <span><i class="legend-task"></i> Tarea / actividad</span>
                </div>

            </section>

            <aside class="evaluation-upcoming">

                <h3>Próximos compromisos</h3>

                ${datedActivities.filter(item =>
                    new Date(item.due_at) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
                ).slice(0, 8).map(item => {
                    const subject = subjects.find(s => s.id === item.subject_id);

                    return `
                        <div class="upcoming-item">
                            <span class="upcoming-date">
                                ${formatDate(item.due_at)}
                            </span>

                            <strong>${escapeHTML(item.title)}</strong>

                            <small>
                                ${escapeHTML(subject?.name || 'Sin asignatura')}
                                · ${getTypeLabel(item.activity_type)}
                            </small>
                        </div>
                    `;
                }).join('') || `
                    <div class="evaluation-no-items">
                        No tienes compromisos próximos registrados.
                    </div>
                `}

            </aside>

        </div>

        <div class="evaluation-calendar-actions">
            <button type="button" id="calendar-add-task">
                <i class="fa-solid fa-plus"></i>
                Agregar tarea
            </button>
        </div>
    `;

    document.getElementById('calendar-add-task')?.addEventListener('click', () => {
        if (!subjects.length) {
            alert('Primero debes registrar una asignatura.');
            return;
        }

        showSubjectSelector();
    });
}

function showSubjectSelector() {
    const modal = document.getElementById('evaluation-modal');

    modal.innerHTML = `
        <div class="evaluation-modal-backdrop">
            <div class="evaluation-modal-content">

                <div class="evaluation-modal-header">
                    <div>
                        <span>NUEVO REGISTRO</span>
                        <h2>Selecciona una asignatura</h2>
                    </div>

                    <button type="button" data-close-evaluation>✕</button>
                </div>

                <div class="evaluation-subject-selector">
                    ${subjects.map(subject => `
                        <button
                            type="button"
                            data-select-subject="${subject.id}">
                            <span
                                class="evaluation-subject-color"
                                style="background:${safeColor(subject.color)}">
                            </span>

                            ${escapeHTML(subject.name)}

                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    `).join('')}
                </div>

            </div>
        </div>
    `;

    modal.hidden = false;

    modal.querySelectorAll('[data-close-evaluation]').forEach(button => {
        button.addEventListener('click', closeEvaluationModal);
    });

    modal.querySelectorAll('[data-select-subject]').forEach(button => {
        button.addEventListener('click', () => {
            const subjectId = button.dataset.selectSubject;
            closeEvaluationModal();
            openTaskModal(subjectId);
        });
    });
}

// ======================================================
// UTILIDADES
// ======================================================

function isGradeEvaluation(activity) {
    return [
        'quiz',
        'control',
        'workshop',
        'assignment',
        'presentation',
        'report',
        'exam'
    ].includes(activity.activity_type);
}

function getTypeLabel(type) {
    return (
        [...GRADE_TYPES, ...CALENDAR_TYPES].find(item =>
            item.value === type
        )?.label || 'Actividad'
    );
}

function formatGrade(value) {
    return Number(value).toFixed(1);
}

function formatNumber(value) {
    return Number(value).toLocaleString('es-CL', {
        maximumFractionDigits: 2
    });
}

function formatRequiredGrade(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }

    if (value <= 1) return '1.0';
    if (value > 7) return 'Imposible';

    return value.toFixed(1);
}

function gradeStatusClass(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'grade-neutral';
    }

    if (value > 7) return 'grade-impossible';
    if (value <= 4) return 'grade-achievable';

    return 'grade-challenging';
}

function formatDate(value) {
    if (!value) return 'Sin fecha';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Sin fecha';

    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function toDateInput(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeColor(value) {
    const color = String(value || '#6366f1');

    return /^#[0-9a-fA-F]{3,8}$/.test(color)
        ? color
        : '#6366f1';
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

