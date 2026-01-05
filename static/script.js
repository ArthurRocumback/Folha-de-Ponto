/**
 * ESTADO E CONFIGURAÇÃO
 */
let usuarioEmEdicaoId = null;

/**
 * INICIALIZAÇÃO
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Relógio e Sidebar
    initClock();
    setInterval(initClock, 1000);
    initSidebarActive();

    // 2. Identificação de Página e Inits Específicos
    if (document.getElementById('loginForm')) {
        initLoginForm();
    }

    if (document.getElementById('perfil-historico-body')) {
        carregarPerfilUsuario();
    }

    if (document.getElementById('user-table-body')) {
        carregarOpcoes();
        carregarTabelaUsuarios();
        const formUser = document.getElementById('formAddUser');
        if (formUser) formUser.addEventListener('submit', salvarUsuario);
    }
});

/**
 * LÓGICA DE LOGIN (Resolve o problema de recarregamento)
 */
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o browser de recarregar

        const feedback = document.getElementById('feedback');
        const btn = document.getElementById('btnEntrar');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        // UI Feedback
        if(feedback) feedback.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>A verificar...`;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameInput.value,
                    password: passwordInput.value
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                window.location.href = result.redirect;
            } else {
                if(feedback) {
                    feedback.innerText = result.message || "Erro ao aceder.";
                    feedback.style.display = 'block';
                    feedback.className = "alert alert-danger animate__animated animate__shakeX";
                }
                btn.disabled = false;
                btn.innerHTML = "Aceder ao Sistema";
            }
        } catch (err) {
            console.error(err);
            if(feedback) {
                feedback.innerText = "Erro de conexão com o servidor.";
                feedback.style.display = 'block';
            }
            btn.disabled = false;
            btn.innerHTML = "Aceder ao Sistema";
        }
    });
}

/**
 * GESTÃO DE UTILIZADORES (ADMIN)
 */
async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('user-table-body');
    if (!tbody) return;

    try {
        const response = await fetch('/api/usuarios');
        const users = await response.json();

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>
                    <div class="fw-bold">${u.nome}</div>
                    <div class="small text-muted">${u.email}</div>
                </td>
                <td><span class="badge bg-light text-dark border">${u.matricula}</span></td>
                <td>${u.departamento}</td>
                <td><span class="badge ${u.nivel_acesso === 'Administrador' ? 'bg-danger' : 'bg-primary'}">${u.nivel_acesso}</span></td>
                <td>
                    <button class="btn btn-sm btn-light border" onclick="abrirModalEdicao(${JSON.stringify(u).replace(/"/g, '&quot;')})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Erro ao carregar utilizadores", e);
    }
}

async function salvarUsuario(e) {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        departamento: document.getElementById('departamento').value,
        cargo: document.getElementById('cargo').value,
        matricula: document.getElementById('matricula').value,
        nivel_acesso: document.getElementById('nivel_acesso').value,
        senha: document.getElementById('senha').value
    };

    const url = usuarioEmEdicaoId ? `/api/usuarios/${usuarioEmEdicaoId}` : '/api/usuarios';
    const method = usuarioEmEdicaoId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            carregarTabelaUsuarios();
            e.target.reset();
        } else {
            alert("Erro ao guardar dados.");
        }
    } catch (e) {
        console.error(e);
    }
}

/**
 * PERFIL DO UTILIZADOR
 */
async function carregarPerfilUsuario() {
    try {
        const res = await fetch('/api/perfil');
        if (!res.ok) return;
        const user = await res.json();

        // Mapeamento de IDs que podem existir tanto no Dashboard quanto no Perfil
        const campos = {
            'user-nome-card': user.nome,
            'user-nome-dash': user.nome,
            'user-email': user.email,
            'user-matricula': user.matricula,
            'user-departamento': user.departamento,
            'user-cargo-card': user.cargo,
            'user-cargo-dash': user.cargo
        };

        for (let id in campos) {
            const el = document.getElementById(id);
            if (el && campos[id]) el.innerText = campos[id];
        }
    } catch (e) { console.error(e); }
}

// Chame essa função no DOMContentLoaded para que funcione em todas as páginas
document.addEventListener('DOMContentLoaded', () => {
    // ... outros inits
    carregarPerfilUsuario(); 
});
/**
 * UTILITÁRIOS
 */
function initClock() {
    const clock = document.getElementById('realtime-clock');
    const date = document.getElementById('realtime-date');
    if (!clock || !date) return;
    const now = new Date();
    clock.innerText = now.toLocaleTimeString('pt-PT');
    date.innerText = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function initSidebarActive() {
    const links = document.querySelectorAll('.sidebar .nav-link');
    const path = window.location.pathname;
    links.forEach(link => {
        if (link.getAttribute('href') === path) link.classList.add('active');
    });
}

async function carregarOpcoes() {
    const depSelect = document.getElementById('departamento');
    const cargoSelect = document.getElementById('cargo');
    if(!depSelect) return;
    
    try {
        const res = await fetch('/api/opcoes');
        const data = await res.json();
        depSelect.innerHTML = data.departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
        cargoSelect.innerHTML = data.cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    } catch (e) { console.error(e); }
}

async function toggleWork() {
    const btn = document.getElementById('btn-registrar');
    const btnText = document.getElementById('btn-text');
    const isEntrada = !btn.classList.contains('saida');
    const tipo = isEntrada ? 'Entrada' : 'Saída';

    try {
        const res = await fetch('/api/ponto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo })
        });

        if (!res.ok) throw new Error();

        if (isEntrada) {
            btn.classList.add('saida');
            btnText.innerHTML = "REGISTRAR<br>SAÍDA";
            showToast("Entrada registrada com sucesso!");
        } else {
            btn.classList.remove('saida');
            btnText.innerHTML = "REGISTRAR<br>ENTRADA";
            showToast("Saída registrada com sucesso!");
        }

        carregarUltimosRegistros();
    } catch {
        showToast("Erro ao registrar ponto.");
    }
}


function showToast(message) {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toast-message');
    if (toastEl && toastMsg) {
        toastMsg.innerText = message;
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}


async function carregarUltimosRegistros() {
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;

    try {
        const res = await fetch('/api/ponto');
        const dados = await res.json();

        tbody.innerHTML = dados.map(r => `
            <tr>
                <td>${r.tipo}</td>
                <td>${new Date(r.horario).toLocaleTimeString()}</td>
                <td>
                    <span class="badge ${r.tipo === 'Entrada' ? 'bg-success' : 'bg-dark'}">
                        OK
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}
