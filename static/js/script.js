/**
 * @param {number} totalItens - Total de registros após o filtro
 * @param {number} itensPorPagina - Quantidade de itens por página
 * @param {number} paginaAtual - A página que está ativa no momento
 * @param {string} containerId - O ID do elemento <ul> onde a paginação será inserida
 * @param {string} callbackNome - O nome da função (string) que será chamada ao clicar
 */

let gestorAtividadesFiltradas = [];
let pagAtualGestor = 1;
const POR_PAGINA_GESTOR = 20;

let auditoriaDados = [];
let auditoriaPaginaAtual = 1;
const AUDITORIA_POR_PAGINA = 90;

let usuarioEmEdicaoId = null;
let gestorEstagiarios = [];
let gestorAtividades = [];


document.addEventListener('DOMContentLoaded', () => {
    initClock();
    setInterval(initClock, 1000);
    initSidebarActive();

    // Carrega o perfil se estiver no Dashboard ou na página de Perfil
    if (document.getElementById('user-nome-dash') || document.getElementById('user-nome-card')) {
        carregarPerfilUsuario();
    }

    if (document.getElementById('loginForm')) {
        initLoginForm();
    }

    if (document.getElementById('perfil-historico-body')) {
        carregarHistoricoPerfil();
    }

    if (document.getElementById('user-table-body')) {
        carregarOpcoes();
        carregarTabelaUsuarios();
        
        const formUser = document.getElementById('formAddUser');
        if (formUser) formUser.addEventListener('submit', salvarUsuario);

        const selectCargo = document.getElementById('cargo');
        if (selectCargo) {
            selectCargo.addEventListener('change', atualizarObrigatoriedadeGestor);
        }
    }

    if (document.getElementById('audit-table-body')) {
        carregarAuditoria();
    }

    if (document.getElementById('log-table-body')) {
        carregarUltimosRegistros();
    }

    if (document.getElementById('gestor-estagiarios-body')) {
        carregarDashboardGestor();
    }
});

/* LÓGICA DE LOGIN (Resolve o problema de recarregamento) */
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
                        u.status === 'Licença' ? 'bg-secondary' :
                        u.status === 'Em Contratação' ? 'bg-danger' :
                        'bg-dark' // Inativo
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

function novoUsuario() {
    usuarioEmEdicaoId = null;

    const form = document.getElementById('formAddUser');
    form.reset();
    form.classList.remove('was-validated'); // 👈 ADICIONE ESTA LINHA

    document.getElementById('modalUserTitle').innerText = 'Criar Usuário';
    atualizarObrigatoriedadeGestor();
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
            document.getElementById('gestor').value = u.gestor;
            document.getElementById('nivel_acesso').value = u.nivel_acesso;
            document.getElementById('senha').value = '';

            document.getElementById('modalUserTitle').innerText = 'Editar Usuário';

            atualizarObrigatoriedadeGestor(); // 👈 AQUI
            new bootstrap.Modal(document.getElementById('addUserModal')).show();
        });
        atualizarObrigatoriedadeGestor();
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
            showToast('Usuário excluído com sucesso.', 'success'); // 👈 Aqui
        } else {
            showToast('Erro ao excluir usuário.', 'error'); // 👈 Aqui
        }
    } catch (e) {
        console.error(e);
        showToast('Erro de conexão com o servidor.', 'error'); // 👈 Aqui
    }
}

async function salvarUsuario(e) {
    e.preventDefault();
    const form = e.target;
    const inputSenha = document.getElementById('senha');

    // 1. Ajusta dinamicamente se a SENHA é obrigatória (só na criação)
    if (!usuarioEmEdicaoId) {
        inputSenha.setAttribute('required', 'required');
    } else {
        inputSenha.removeAttribute('required');
    }

    // 2. VALIDAÇÃO VISUAL DO BOOTSTRAP
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated'); // Pinta os campos inválidos de vermelho
        showToast("Preencha os campos obrigatórios destacados em vermelho.", "error");
        return;
    }

    // Se chegou aqui, o formulário está válido. Removemos a classe de validação.
    form.classList.remove('was-validated');

    // 3. Coleta dos dados
    const dados = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        departamento: document.getElementById('departamento').value,
        cargo: document.getElementById('cargo').value,
        gestor: document.getElementById('gestor').value,
        matricula: document.getElementById('matricula').value.toLowerCase(),
        nivel_acesso: document.getElementById('nivel_acesso').value,
        status: document.getElementById('status').value
    };

    if (inputSenha.value) dados.senha = inputSenha.value;

    const url = usuarioEmEdicaoId ? `/api/usuarios/${usuarioEmEdicaoId}` : '/api/usuarios';
    const method = usuarioEmEdicaoId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erro ao salvar usuário');
        }

        bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
        usuarioEmEdicaoId = null;
        form.reset();
        carregarTabelaUsuarios();
        showToast("Usuário salvo com sucesso!", "success");

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
    }
}

/** PERFIL DO UTILIZADOR */
async function carregarPerfilUsuario() {
    try {
        const res = await fetch('/api/perfil');
        if (!res.ok) return;
        const user = await res.json();

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
    } catch (e) { console.error('Erro ao carregar perfil:', e); }
}


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
    const gestorSelect = document.getElementById('gestor');
    if(!depSelect) return;
    
    try {
        const res = await fetch('/api/opcoes');
        const data = await res.json();
        depSelect.innerHTML = data.departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
        cargoSelect.innerHTML = data.cargos.map(c => `<option value="${c}">${c}</option>`).join('');

        if (gestorSelect) {
            gestorSelect.innerHTML =
                `<option value="">Selecione um gestor</option>` + data.gestores .map(g => `<option value="${g}">${g}</option>`)
            .join('');
        }
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


function showToast(message, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toast-message');
    const toastHeader = document.getElementById('toast-header');
    const toastTitle = document.getElementById('toast-title');

    if (toastEl && toastMsg && toastHeader) {
        toastMsg.innerText = message;

        toastHeader.classList.remove('bg-success', 'bg-danger', 'bg-warning');

        if (type === 'success') {
            toastHeader.classList.add('bg-success');
            toastTitle.innerText = "Sucesso";
        } else if (type === 'error') {
            toastHeader.classList.add('bg-danger');
            toastTitle.innerText = "Erro";
        } else {
            toastHeader.classList.add('bg-warning');
            toastTitle.innerText = "Aviso";
        }

        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
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
        if (!res.ok) throw new Error('Erro na API');

        const dados = await res.json();

        tbody.innerHTML = dados.map(r => {
            const dt = new Date(r.horario + 'Z');
            return `
                <tr>
                    <td>${r.tipo}</td>
                    <td>${dt.toLocaleDateString('pt-BR')}</td>
                    <td>${dt.toLocaleTimeString('pt-BR')}</td>
                    <td><span class="badge ${r.tipo === 'Entrada' ? 'bg-success' : 'bg-dark'}"> OK </span></td>
                </tr>
            `;
        }).join('');

        // Sincroniza o botão de registro
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
    } catch (e) {
        console.error("Erro ao carregar registros:", e);
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

function carregarAuditoria() {
    fetch('/api/auditoria')
        .then(res => res.json())
        .then(dados => {
            auditoriaDados = dados;
            renderizarTabelaAuditoria();
            renderizarPaginacaoModular(
                auditoriaDados.length, 
                AUDITORIA_POR_PAGINA, 
                auditoriaPaginaAtual, 
                'audit-pagination', 
                'mudarPagina'
            );
        });
}

function renderizarTabelaAuditoria() {
    const tbody = document.getElementById('audit-table-body');

    const inicio = (auditoriaPaginaAtual - 1) * AUDITORIA_POR_PAGINA;
    const fim = inicio + AUDITORIA_POR_PAGINA;

    const pagina = auditoriaDados.slice(inicio, fim);

    const totalRegistros = auditoriaDados.length;

    tbody.innerHTML = pagina.map((l, index) => {

        // Número global invertido:
        // mais antigo = 1 | mais recente = total
        const numeroItem = totalRegistros - (inicio + index);

        // Formata para 5 dígitos → 00001
        const numeroFormatado = String(numeroItem).padStart(5, '0');

        let badgeClass = 'bg-secondary';
        if (l.acao === 'CREATE') badgeClass = 'bg-success';
        else if (l.acao === 'UPDATE') badgeClass = 'bg-warning text-dark';
        else if (l.acao === 'DELETE') badgeClass = 'bg-danger';
        else if (l.acao === 'PONTO_ENTRADA') badgeClass = 'bg-primary';
        else if (l.acao === 'PONTO_SAÍDA') badgeClass = 'bg-dark';

        return `
            <tr>
                <td class="copy-cell text-muted fw-bold">${numeroFormatado}</td>
                <td class="copy-cell"><span class="badge ${badgeClass}">${l.acao}</span></td>
                <td class="copy-cell">${l.usuario_afetado}</td>
                <td class="copy-cell fw-bold">${l.executado_por}</td>
                <td class="copy-cell">${new Date(l.data).toLocaleString()}</td>
            </tr>
        `;
    }).join('');

}

function mudarPaginaGestor(num) {
    pagAtualGestor = num;
    renderizarTabelaAtividades();
    renderizarPaginacaoModular(
        gestorAtividadesFiltradas.length, 
        POR_PAGINA_GESTOR, 
        pagAtualGestor, 
        'gestor-pagination', 
        'mudarPaginaGestor'
    );
    const container = document.querySelector('.audit-scroll');
    if (container) container.scrollTop = 0;
}

function renderizarPaginacaoModular(totalItens, itensPorPagina, paginaAtual, containerId, callbackNome) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    const maxVizinhas = 1;

    // Botão Anterior
    html += `
        <li class="page-item ${paginaAtual === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="${callbackNome}(${paginaAtual - 1})">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>`;

    // Lógica de páginas (Primeira, Vizinhas, Última)
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaAtual - maxVizinhas && i <= paginaAtual + maxVizinhas)) {
            html += `
                <li class="page-item ${i === paginaAtual ? 'active' : ''}">
                    <button class="page-link" onclick="${callbackNome}(${i})">${i}</button>
                </li>`;
        } else if (i === paginaAtual - (maxVizinhas + 1) || i === paginaAtual + (maxVizinhas + 1)) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    // Botão Próximo
    html += `
        <li class="page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}">
            <button class="page-link" onclick="${callbackNome}(${paginaAtual + 1})">
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>`;

    container.innerHTML = html;
}


function copiarTexto(texto) {
    if (!texto) return;

    navigator.clipboard.writeText(texto).then(() => {
        showToast('Texto Copiado');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        showToast('Erro ao copiar');
    });
}


document.addEventListener('click', function (e) {
    const cell = e.target.closest('.copy-cell');
    if (!cell) return;

    copiarTexto(cell.innerText.trim());
});

function atualizarObrigatoriedadeGestor() {
    const cargoEl = document.getElementById('cargo');
    const gestor = document.getElementById('gestor');
    const asterisco = document.getElementById('asterisco-gestor'); // Captura o asterisco

    if (!cargoEl || !gestor) return;

    const cargo = cargoEl.value.toLowerCase();

    if (cargo.includes('estagiário')) {
        gestor.setAttribute('required', 'required');
        if (asterisco) asterisco.classList.remove('d-none');
    } else {
        gestor.removeAttribute('required');
        if (asterisco) asterisco.classList.add('d-none');
    }
}

function formatarAcaoPonto(acao) {
    const labels = {
        'PONTO_ENTRADA': { text: 'Entrada', class: 'badge-entrada' },
        'PONTO_SAÍDA': { text: 'Saída', class: 'badge-saida' },
        'LOGIN': { text: 'LOGIN', class: 'badge-neutral' },
        'LOGOUT': { text: 'LOGOUT', class: 'badge-neutral' },
        'UPDATE': { text: 'UPDATE', class: 'badge-neutral' }
    };
    const item = labels[acao] || { text: acao, class: 'badge-neutral' };
    return `<span class="badge-ponto ${item.class}">${item.text}</span>`;
}

function renderizarTabelaEstagiarios(dados) {
    const tbody = document.getElementById('gestor-estagiarios-body');
    if (!tbody) return;
    tbody.innerHTML = dados.map(e => `
        <tr>
            <td class="fw-bold text-dark">${e.nome}</td>
            <td class="text-muted small">${e.email}</td>
            <td class="text-muted fw-bold">${e.departamento || 'TI'}</td>
            <td class="text-center-column">
                <span class="badge-status ${e.status === 'Ativo' ? 'badge-ativo' : 'badge-inativo'}">
                    ${e.status}
                </span>
            </td>
        </tr>
    `).join('');
}

async function carregarDashboardGestor() {
    // ===== ESTAGIÁRIOS =====
    const tbodyEst = document.getElementById('gestor-estagiarios-body');
    if (tbodyEst) {
        try {
            const res = await fetch('/api/gestor/estagiarios');
            gestorEstagiarios = await res.json();
            
            // ✅ CORREÇÃO: Chama a função para desenhar a tabela da equipe
            renderizarTabelaEstagiarios(gestorEstagiarios);
            
            // ✅ CORREÇÃO: Atualiza os KPIs de contagem da equipe
            const totalEstEl = document.getElementById('total-estagiarios');
            const ativosEl = document.getElementById('estagiarios-ativos');
            if (totalEstEl) totalEstEl.innerText = gestorEstagiarios.length;
            if (ativosEl) ativosEl.innerText = gestorEstagiarios.filter(e => e.status === 'Ativo').length;

        } catch (e) { console.error("Erro ao carregar estagiários:", e); }
    }

    // ===== ATIVIDADES =====
    const tbodyAud = document.getElementById('gestor-auditoria-body');
    if (tbodyAud) {
        try {
            const res = await fetch('/api/gestor/estagiarios/auditoria');
            gestorAtividades = await res.json();
        } catch (e) { console.error("Erro ao carregar auditoria:", e); }
    }

    const filtroInput = document.getElementById('filtro-gestor');
    if (filtroInput) {
        filtroInput.addEventListener('input', aplicarFiltroGestor);
    }

    aplicarFiltroGestor();
}

function aplicarFiltroGestor() {
    const termo = document.getElementById('filtro-gestor').value.toLowerCase().trim();

    // FILTRA APENAS O HISTÓRICO (Não mexe no gestorEstagiarios)
    gestorAtividadesFiltradas = gestorAtividades.filter(a => {
        return (a.acao || "").toLowerCase().includes(termo) || 
               (a.usuario_afetado || "").toLowerCase().includes(termo) || 
               (a.executado_por || "").toLowerCase().includes(termo) || 
               new Date(a.data).toLocaleString('pt-BR').toLowerCase().includes(termo);
    });

    renderizarTabelaAtividades();
    
    // REUTILIZANDO A PAGINAÇÃO GENÉRICA
    renderizarPaginacaoModular(
        gestorAtividadesFiltradas.length, 
        POR_PAGINA_GESTOR, 
        pagAtualGestor, 
        'gestor-pagination', 
        'mudarPaginaGestor'
    );

    const kpiAtividades = document.getElementById('total-atividades');
    if (kpiAtividades) kpiAtividades.innerText = gestorAtividadesFiltradas.length;
}

function renderizarTabelaAtividades() {
    const tbody = document.getElementById('gestor-auditoria-body');
    if (!tbody) return;

    const inicio = (pagAtualGestor - 1) * POR_PAGINA_GESTOR;
    const slicePagina = gestorAtividadesFiltradas.slice(inicio, inicio + POR_PAGINA_GESTOR);

    tbody.innerHTML = slicePagina.map(l => `
        <tr>
            <td>${formatarAcaoPonto(l.acao)}</td>
            <td class="fw-bold text-dark">${l.usuario_afetado}</td>
            <td class="text-muted">${l.executado_por}</td>
            <td class="text-center-column fw-bold text-dark">
                ${new Date(l.data + 'Z').toLocaleString('pt-BR')}  </td>
        </tr>
    `).join('');
}