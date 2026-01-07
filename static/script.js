/**
 * ESTADO E CONFIGURAÇÃO
 */
let usuarioEmEdicaoId = null;

/**
 * INICIALIZAÇÃO
 */
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    setInterval(initClock, 1000);
    initSidebarActive();

    if (document.getElementById('loginForm')) {
        initLoginForm();
    }

    if (document.getElementById('perfil-historico-body')) {
        carregarPerfilUsuario();
        carregarHistoricoPerfil();
    }

    if (document.getElementById('user-table-body')) {
        carregarOpcoes();
        carregarTabelaUsuarios();
        const formUser = document.getElementById('formAddUser');
        if (formUser) formUser.addEventListener('submit', salvarUsuario);
    }

    // ✅ AQUI É O QUE VOCÊ NÃO TINHA ENTENDIDO
    if (document.getElementById('log-table-body')) {
        carregarUltimosRegistros();
    }
    if (document.getElementById('audit-table-body')) {
    carregarAuditoria();
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
                <td class="fw-bold">${u.nome}</td>

                <td>${u.email}</td>

                <td>${u.departamento || '-'}</td>

                <td>${u.matricula}</td>

                <td>
                    <span class="badge ${
                        u.status === 'Ativo' ? 'bg-success' :
                        u.status === 'Férias' ? 'bg-warning text-dark' :
                        u.status === 'Atestado' ? 'bg-info text-dark' :
                        u.status === 'Licença' ? 'bg-primary' :
                        'bg-secondary'
                    }">
                        ${u.status || 'Ativo'}
                    </span>
                </td>

                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="editarUsuario(${u.id})" title="Editar usuário"> <i class="bi bi-pencil"></i> </button>

                    <button class="btn btn-sm btn-outline-danger" onclick="confirmarExclusao(${u.id}, '${u.nome}')" title="Excluir usuário"> <i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        console.error('Erro ao carregar usuários:', e);
    }
}

function editarUsuario(id) {
    usuarioEmEdicaoId = id;

    fetch('/api/usuarios')
        .then(res => res.json())
        .then(users => {
            const u = users.find(x => x.id === id);
            if (!u) return;

            document.getElementById('nome').value = u.nome;
            document.getElementById('email').value = u.email;
            document.getElementById('departamento').value = u.departamento;
            document.getElementById('cargo').value = u.cargo;
            document.getElementById('matricula').value = u.matricula;
            document.getElementById('nivel_acesso').value = u.nivel_acesso;
            document.getElementById('senha').value = '';

            document.querySelector('#addUserModal h5').innerText = 'Editar Usuário';

            new bootstrap.Modal(document.getElementById('addUserModal')).show();
        });
}


async function confirmarExclusao(id, nome) {
    const ok = confirm(`Tem certeza que deseja excluir o usuário "${nome}"?`);
    if (!ok) return;

    try {
        const res = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            carregarTabelaUsuarios();
            alert('Usuário excluído com sucesso.');
        } else {
            alert('Erro ao excluir usuário.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro de conexão.');
    }
}

async function salvarUsuario(e) {
    e.preventDefault();

    const senhaValor = document.getElementById('senha').value;

    // ✅ VALIDAÇÃO: senha obrigatória apenas na criação
    if (!usuarioEmEdicaoId && !senhaValor) {
        alert('Senha é obrigatória para novos usuários');
        return;
    }

    const dados = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        departamento: document.getElementById('departamento').value,
        cargo: document.getElementById('cargo').value,
        matricula: document.getElementById('matricula').value,
        nivel_acesso: document.getElementById('nivel_acesso').value,
        status: document.getElementById('status').value
    };

    // Só envia senha se foi preenchida
    if (senhaValor) {
        dados.senha = senhaValor;
    }

    const url = usuarioEmEdicaoId
        ? `/api/usuarios/${usuarioEmEdicaoId}`
        : '/api/usuarios';

    const method = usuarioEmEdicaoId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) {
            throw new Error('Erro ao salvar usuário');
        }

        bootstrap.Modal
            .getInstance(document.getElementById('addUserModal'))
            .hide();

        usuarioEmEdicaoId = null;
        e.target.reset();
        carregarTabelaUsuarios();

    } catch (err) {
        console.error(err);
        alert('Erro ao salvar usuário');
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

    if (btn.classList.contains('processing')) return;

    btn.classList.add('processing');
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";

    const isEntrada = !btn.classList.contains('saida');
    const tipo = isEntrada ? 'Entrada' : 'Saída';

    try {
        // 🔥 AGORA O FETCH EXISTE
        const res = await fetch('/api/ponto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo })
        });

        if (!res.ok) {
            throw new Error('Erro ao registrar ponto');
        }

        await res.json(); // mantém padrão, mesmo que não use retorno

        if (isEntrada) {
            btn.classList.add('saida');
            btnText.innerHTML = "REGISTRAR<br>SAÍDA";
        } else {
            btn.classList.remove('saida');
            btnText.innerHTML = "REGISTRAR<br>ENTRADA";
        }

        showToast(`${tipo} registrada com sucesso!`);
        await carregarUltimosRegistros();

    } catch (e) {
        console.error(e);
        showToast("Erro ao registrar ponto.");
    } finally {
        setTimeout(() => {
            btn.classList.remove('processing');
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
        }, 2000);
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
    const btn = document.getElementById('btn-registrar');
    const btnText = document.getElementById('btn-text');

    if (!tbody) return;

    try {
        const res = await fetch('/api/ponto');

        if (!res.ok) {
            throw new Error('Não autorizado ou erro na API');
        }

        const dados = await res.json();

        tbody.innerHTML = dados.map(r => {
            const dt = new Date(r.horario + 'Z');

            return `
                <tr>
                    <td>${r.tipo}</td>
                    <td>${dt.toLocaleDateString('pt-BR')}</td>
                    <td>${dt.toLocaleTimeString('pt-BR')}</td>
                    <td>
                        <span class="badge ${r.tipo === 'Entrada' ? 'bg-success' : 'bg-dark'}"> OK </span>
                    </td>
                </tr>
            `;
        }).join('');

        // Sincroniza botão com último registro
        if (dados.length > 0 && btn && btnText) {
            const ultimo = dados[0];

            if (ultimo.tipo === 'Entrada') {
                btn.classList.add('saida');
                btnText.innerHTML = "REGISTRAR<br>SAÍDA";
            } else {
                btn.classList.remove('saida');
                btnText.innerHTML = "REGISTRAR<br>ENTRADA";
            }
        }
        if (dados.length > 0) {
            document.getElementById('location-text').innerText =
                dados[0].localizacao || 'Localização não disponível';
        }

    } catch (e) {
        console.error("Erro ao carregar últimos registros:", e);
    }
}


async function carregarHistoricoPerfil() {
    const tbody = document.getElementById('perfil-historico-body');
    if (!tbody) return;

    try {
        const res = await fetch('/api/ponto/historico');
        const dados = await res.json();

        if (dados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        Nenhum registro encontrado
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = dados.map(r => {
            const dt = new Date(r.horario + 'Z');

            return `
                <tr>
                    <td>${dt.toLocaleDateString('pt-BR')}</td>
                    <td>${r.tipo}</td>
                    <td>${dt.toLocaleTimeString('pt-BR')}</td>
                    <td>
                        <span class="badge ${r.tipo === 'Entrada' ? 'bg-success' : 'bg-dark'}">
                            OK
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

async function carregarAuditoria() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    try {
        const res = await fetch('/api/auditoria');
        const logs = await res.json();

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                        Nenhum registro encontrado
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logs.map(l => {

            let badgeClass = 'bg-secondary';

            if (l.acao === 'CREATE') {
                badgeClass = 'bg-success';
            } 
            else if (l.acao === 'UPDATE') {
                badgeClass = 'bg-warning text-dark';
            } 
            else if (l.acao === 'DELETE') {
                badgeClass = 'bg-danger';
            }
            else if (l.acao === 'PONTO_ENTRADA') {
                badgeClass = 'bg-primary';
            }
            else if (l.acao === 'PONTO_SAÍDA') {
                badgeClass = 'bg-dark';
            }

            return `
                <tr>
                    <td>
                        <span class="badge ${badgeClass}">
                            ${l.acao}
                        </span>
                    </td>
                    <td>${l.usuario_afetado}</td>
                    <td class="fw-bold">${l.executado_por}</td>
                    <td>${new Date(l.data).toLocaleString()}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Erro ao carregar auditoria:', e);
    }
}