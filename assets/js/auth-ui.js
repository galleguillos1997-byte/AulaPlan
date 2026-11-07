
import {
    loginUser,
    registerUser,
    recoverPassword
} from './auth.js';

const app = document.getElementById('app');

let currentView = 'login';

function showMessage(message, type = 'success') {
    const element = document.getElementById('auth-message');

    if (!element) return;

    element.textContent = message;
    element.className = `auth-message visible ${type}`;
}

function setLoading(loading, text = 'Continuar') {
    const button = document.getElementById('auth-submit');

    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? 'Procesando...' : text;
}

function renderAuth() {
    const views = {
        login: {
            title: 'Bienvenido de nuevo',
            description: 'Ingresa a tu espacio académico y continúa organizando tus estudios.',
            button: 'Iniciar sesión'
        },
        register: {
            title: 'Crea tu cuenta',
            description: 'Comienza a organizar tus clases, evaluaciones y sesiones de estudio.',
            button: 'Crear mi cuenta'
        },
        recovery: {
            title: 'Recuperar contraseña',
            description: 'Te enviaremos un enlace para que puedas establecer una nueva contraseña.',
            button: 'Enviar enlace'
        }
    };

    const view = views[currentView];

    let fields = '';

    if (currentView === 'register') {
        fields += `
            <div class="auth-field">
                <label for="auth-name">Nombre completo</label>
                <input id="auth-name" type="text" required maxlength="150"
                    autocomplete="name" placeholder="Tu nombre">
            </div>

            <div class="auth-field">
                <label for="auth-institution">Institución educativa</label>
                <input id="auth-institution" type="text"
                    placeholder="Universidad o instituto">
            </div>

            <div class="auth-field">
                <label for="auth-career">Carrera</label>
                <input id="auth-career" type="text"
                    placeholder="Tu carrera">
            </div>
        `;
    }

    fields += `
        <div class="auth-field">
            <label for="auth-email">Correo electrónico</label>
            <input id="auth-email" type="email" required
                autocomplete="email" placeholder="nombre@correo.com">
        </div>
    `;

    if (currentView !== 'recovery') {
        fields += `
            <div class="auth-field">
                <label for="auth-password">Contraseña</label>
                <input id="auth-password" type="password" required
                    minlength="8"
                    autocomplete="${currentView === 'login' ? 'current-password' : 'new-password'}"
                    placeholder="Mínimo 8 caracteres">
            </div>
        `;
    }

    const forgotPassword = currentView === 'login'
        ? `<div class="auth-forgot">
                <button type="button" id="auth-recovery">
                    ¿Olvidaste tu contraseña?
                </button>
           </div>`
        : '';

    app.innerHTML = `
        <main class="auth-wrapper">
            <section class="auth-brand">
                <div class="auth-logo">AulaPlan.</div>

                <div class="auth-brand-content">
                    <h1>Tu vida académica, bajo control.</h1>
                    <p>
                        Organiza tus clases, anticipa tus evaluaciones
                        y transforma tus tiempos disponibles en oportunidades de aprendizaje.
                    </p>

                    <div class="auth-benefits">
                        <div class="auth-benefit">
                            <span>✓</span>
                            <span>Organiza tu calendario académico</span>
                        </div>
                        <div class="auth-benefit">
                            <span>✓</span>
                            <span>Planifica tus sesiones de estudio</span>
                        </div>
                        <div class="auth-benefit">
                            <span>✓</span>
                            <span>Prioriza tus próximas evaluaciones</span>
                        </div>
                    </div>
                </div>

                <div class="auth-brand-footer">
                    AulaPlan · Tu compañero de organización académica
                </div>
            </section>

            <section class="auth-panel">
                <div class="auth-form-container">
                    <div class="auth-heading">
                        <h2>${view.title}</h2>
                        <p>${view.description}</p>
                    </div>

                    <div id="auth-message" class="auth-message"></div>

                    <form id="auth-form" class="auth-form">
                        ${fields}
                        ${forgotPassword}
                        <button id="auth-submit" class="auth-submit" type="submit">
                            ${view.button}
                        </button>
                    </form>

                    <div class="auth-switch" id="auth-switch"></div>
                </div>
            </section>
        </main>
    `;

    renderSwitch();

    document.getElementById('auth-form')
        .addEventListener('submit', handleSubmit);

    document.getElementById('auth-recovery')
        ?.addEventListener('click', () => changeView('recovery'));
}

function renderSwitch() {
    const element = document.getElementById('auth-switch');

    if (currentView === 'login') {
        element.innerHTML = `
            ¿No tienes una cuenta?
            <button class="auth-link" id="auth-register" type="button">
                Regístrate
            </button>
        `;
    } else if (currentView === 'register') {
        element.innerHTML = `
            ¿Ya tienes una cuenta?
            <button class="auth-link" id="auth-login" type="button">
                Inicia sesión
            </button>
        `;
    } else {
        element.innerHTML = `
            <button class="auth-link" id="auth-login" type="button">
                Volver al inicio de sesión
            </button>
        `;
    }

    document.getElementById('auth-register')
        ?.addEventListener('click', () => changeView('register'));

    document.getElementById('auth-login')
        ?.addEventListener('click', () => changeView('login'));
}

function changeView(view) {
    currentView = view;
    renderAuth();
}

async function handleSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password')?.value;
    
    setLoading(true);

    try {
        if (currentView === 'login') {
            await loginUser(email, password);
        }

        if (currentView === 'register') {
            const fullName = document.getElementById('auth-name').value.trim();

            if (!fullName) {
                throw new Error('Ingresa tu nombre completo.');
            }

            const result = await registerUser({
                fullName,
                email,
                password,
                institution: document.getElementById('auth-institution').value,
                career: document.getElementById('auth-career').value
            });

            if (!result.session) {
                showMessage(
                    'Tu cuenta fue creada. Revisa tu correo para confirmar el registro.',
                    'success'
                );
                setLoading(false, 'Crear mi cuenta');
                return;
            }
        }

        if (currentView === 'recovery') {
            await recoverPassword(email);

            showMessage(
                'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',
                'success'
            );

            setLoading(false, 'Enviar enlace');
            return;
        }

        showMessage('Operación realizada correctamente.', 'success');

        window.dispatchEvent(new CustomEvent('aulaplan:auth-success'));

    } catch (error) {
        showMessage(error.message || 'No fue posible completar la operación.', 'error');
    } finally {
        setLoading(false, viewsButtonText());
    }
}

function viewsButtonText() {
    return {
        login: 'Iniciar sesión',
        register: 'Crear mi cuenta',
        recovery: 'Enviar enlace'
    }[currentView];
}

export function renderAuthUI() {
    currentView = 'login';
    renderAuth();
}
