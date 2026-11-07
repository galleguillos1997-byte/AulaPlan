
import { supabase } from './config.js';

let subjects = [];
let editingSubjectId = null;

const colors = [
    '#4F46E5',
    '#0891B2',
    '#059669',
    '#D97706',
    '#DC2626',
    '#9333EA',
    '#DB2777',
    '#475569'
];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

export async function renderSubjectsUI() {
    const app = document.getElementById('dashboard-view-content');

    if (!app) {
        console.error('No se encontró el contenedor del módulo.');
        return;
    }

    app.innerHTML = `
        <main class="subjects-page">
            <header class="subjects-header">
                <div>
                    <h1>Mis asignaturas</h1>
                    <p>Organiza y administra tus ramos académicos.</p>
                </div>

                <button id="subject-new" class="subject-primary-button">
                    + Nueva asignatura
                </button>
            </header>

            <section class="subjects-summary">
                <div>
                    <span>Total de asignaturas</span>
                    <strong id="subjects-total">0</strong>
                </div>
                <div>
                    <span>Asignaturas registradas</span>
                    <strong>Mi espacio académico</strong>
                </div>
            </section>

            <section id="subjects-list" class="subjects-grid">
                <p>Cargando asignaturas...</p>
            </section>
        </main>

        <div id="subject-modal" class="subject-modal" hidden>
            <div class="subject-modal-content">

                <div class="subject-modal-header">
                    <div>
                        <h2 id="subject-modal-title">Nueva asignatura</h2>
                        <p>Completa los datos de tu ramo.</p>
                    </div>
                    <button type="button" id="subject-close">✕</button>
                </div>

                <form id="subject-form">

                    <label for="subject-name">Nombre de la asignatura *</label>
                    <input id="subject-name" maxlength="100"
                        placeholder="Ej. Matemáticas" required>

                    <label for="subject-code">Código de asignatura</label>
                    <input id="subject-code" maxlength="30"
                        placeholder="Ej. MAT101">

                    <label for="subject-teacher">Docente</label>
                    <input id="subject-teacher" maxlength="100"
                        placeholder="Nombre del profesor">

                    <label for="subject-description">Descripción</label>
                    <textarea id="subject-description" maxlength="500"
                        placeholder="Información adicional sobre la asignatura"></textarea>

                    <label>Color identificador</label>
                    <div id="subject-colors" class="subject-colors">
                        ${colors.map((color, index) => `
                            <button type="button"
                                class="subject-color-option ${index === 0 ? 'selected' : ''}"
                                data-color="${color}"
                                style="background:${color}"
                                aria-label="Seleccionar color ${index + 1}">
                            </button>
                        `).join('')}
                    </div>

                    <div id="subject-error" class="subject-error"></div>

                    <div class="subject-modal-actions">
                        <button type="button" id="subject-cancel">
                            Cancelar
                        </button>
                        <button type="submit" class="subject-primary-button"
                            id="subject-save">
                            Guardar asignatura
                        </button>
                    </div>

                </form>
            </div>
        </div>
    `;

    bindSubjectEvents();
    await loadSubjects();
}

async function loadSubjects() {
    const list = document.getElementById('subjects-list');

    try {
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        subjects = data || [];

        document.getElementById('subjects-total').textContent =
            subjects.length;

        renderSubjectCards();

    } catch (error) {
        console.error('Error cargando asignaturas:', error);

        list.innerHTML = `
            <div class="subject-empty">
                No fue posible cargar tus asignaturas.
                Intenta nuevamente.
            </div>
        `;
    }
}

function renderSubjectCards() {
    const list = document.getElementById('subjects-list');

    if (!subjects.length) {
        list.innerHTML = `
            <div class="subject-empty">
                <div class="subject-empty-icon">▤</div>
                <h3>Aún no tienes asignaturas</h3>
                <p>Agrega tu primer ramo para comenzar a organizar tu vida académica.</p>
                <button class="subject-primary-button" id="subject-empty-new">
                    + Agregar mi primera asignatura
                </button>
            </div>
        `;

        document.getElementById('subject-empty-new')
            ?.addEventListener('click', openNewSubject);

        return;
    }

    list.innerHTML = subjects.map(subject => `
        <article class="subject-card"
            style="--subject-color:${escapeHTML(subject.color || colors[0])}">

            <div class="subject-card-top">
                <span class="subject-color-indicator"></span>

                <div class="subject-card-actions">
                    <button type="button"
                        data-edit="${subject.id}"
                        aria-label="Editar asignatura">✎</button>

                    <button type="button"
                        data-delete="${subject.id}"
                        aria-label="Eliminar asignatura">✕</button>
                </div>
            </div>

            <h3>${escapeHTML(subject.name)}</h3>

            <p class="subject-code">
                ${escapeHTML(subject.code || 'Sin código registrado')}
            </p>

            <div class="subject-card-details">
                <span>Docente</span>
                <strong>${escapeHTML(subject.teacher || 'No especificado')}</strong>
            </div>

            ${subject.description ? `
                <p class="subject-description">
                    ${escapeHTML(subject.description)}
                </p>
            ` : ''}

        </article>
    `).join('');

    list.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
            editSubject(button.dataset.edit);
        });
    });

    list.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
            deleteSubject(button.dataset.delete);
        });
    });
}

function bindSubjectEvents() {
    document.getElementById('subject-new')
        .addEventListener('click', openNewSubject);

    document.getElementById('subject-close')
        .addEventListener('click', closeSubjectModal);

    document.getElementById('subject-cancel')
        .addEventListener('click', closeSubjectModal);

    document.getElementById('subject-form')
        .addEventListener('submit', saveSubject);

    document.querySelectorAll('.subject-color-option')
        .forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.subject-color-option')
                    .forEach(option => option.classList.remove('selected'));

                button.classList.add('selected');
            });
        });
}

function openNewSubject() {
    editingSubjectId = null;

    document.getElementById('subject-form').reset();

    document.getElementById('subject-modal-title').textContent =
        'Nueva asignatura';

    document.getElementById('subject-save').textContent =
        'Guardar asignatura';

    document.querySelectorAll('.subject-color-option')
        .forEach((button, index) => {
            button.classList.toggle('selected', index === 0);
        });

    document.getElementById('subject-error').textContent = '';

    document.getElementById('subject-modal').hidden = false;
}

function editSubject(id) {
    const subject = subjects.find(item => item.id === id);

    if (!subject) return;

    editingSubjectId = id;

    document.getElementById('subject-name').value = subject.name || '';
    document.getElementById('subject-code').value = subject.code || '';
    document.getElementById('subject-teacher').value = subject.teacher || '';
    document.getElementById('subject-description').value =
        subject.description || '';

    document.getElementById('subject-modal-title').textContent =
        'Editar asignatura';

    document.getElementById('subject-save').textContent =
        'Guardar cambios';

    document.querySelectorAll('.subject-color-option')
        .forEach(button => {
            button.classList.toggle(
                'selected',
                button.dataset.color === (subject.color || colors[0])
            );
        });

    document.getElementById('subject-error').textContent = '';
    document.getElementById('subject-modal').hidden = false;
}

function closeSubjectModal() {
    document.getElementById('subject-modal').hidden = true;
    editingSubjectId = null;
}

async function saveSubject(event) {
    event.preventDefault();

    const saveButton = document.getElementById('subject-save');
    const errorContainer = document.getElementById('subject-error');

    const name = document.getElementById('subject-name').value.trim();

    if (!name) {
        errorContainer.textContent = 'El nombre es obligatorio.';
        return;
    }

    const selectedColor = document.querySelector(
        '.subject-color-option.selected'
    );

    const payload = {
        name,
        code: document.getElementById('subject-code').value.trim() || null,
        teacher: document.getElementById('subject-teacher').value.trim() || null,
        description: document.getElementById('subject-description').value.trim() || null,
        color: selectedColor?.dataset.color || colors[0]
    };

    saveButton.disabled = true;
    saveButton.textContent = 'Guardando...';
    errorContainer.textContent = '';

    try {
        let result;

        if (editingSubjectId) {
            result = await supabase
                .from('subjects')
                .update(payload)
                .eq('id', editingSubjectId);
        } else {
            result = await supabase
                .from('subjects')
                .insert(payload);
        }

        if (result.error) throw result.error;

        closeSubjectModal();
        await loadSubjects();

    } catch (error) {
        console.error('Error guardando asignatura:', error);
        errorContainer.textContent =
            'No fue posible guardar. Revisa tu conexión e inténtalo nuevamente.';
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = editingSubjectId
            ? 'Guardar cambios'
            : 'Guardar asignatura';
    }
}

async function deleteSubject(id) {
    const subject = subjects.find(item => item.id === id);

    if (!subject) return;

    const confirmed = confirm(
        `¿Estás seguro de eliminar la asignatura "${subject.name}"?`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadSubjects();

    } catch (error) {
        console.error('Error eliminando asignatura:', error);
        alert('No fue posible eliminar la asignatura.');
    }
}
