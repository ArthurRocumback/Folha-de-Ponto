/**
 * ==========================================================
 * SCRIPT PRINCIPAL DA APLICAÇÃO
 * Sistema de Ponto Digital
 *
 * Responsabilidades:
 * - Comunicação com backend (API Flask)
 * - Controle do sistema de ponto (entrada / saída)
 * - Atualização de UI (relógio, botões, tabelas)
 * - Feedback visual (toast)
 * - Navegação (sidebar ativa)
 * ==========================================================
 */


/**
 * ==========================================================
 * ESTADO GLOBAL DA APLICAÇÃO
 * ==========================================================
 * Guarda informações temporárias da sessão do usuário.
 * Em um sistema real, isso viria do backend.
 */
const state = {
    working: false,   // Indica se o usuário está em jornada ativa
    startTime: null,  // Hora de início da jornada
    logs: []          // Histórico local de registros (entrada/saída)
};


/**
 * ==========================================================
 * INICIALIZAÇÃO DA APLICAÇÃO
 * ==========================================================
 * Executa automaticamente quando o DOM termina de carregar.
 * Garante que os elementos HTML já existem antes do JS rodar.
 */
document.addEventListener('DOMContentLoaded', () => {
    initClock();              // Inicia relógio em tempo real
    initSidebarActive();      // Marca item ativo da sidebar
    initUserForm();           // Prepara formulário de usuários (se existir)

    carregarOpcoes();         // Busca departamentos e cargos
    carregarTabelaUsuarios(); // Preenche tabela de usuários (admin)

    syncButtonUI();           // Ajusta estado inicial do botão de ponto
    renderTable();            // Renderiza histórico de ponto
});


/**
 * ==========================================================
 * COMUNICAÇÃO COM BACKEND (API)
 * ==========================================================
 */

/**
 * Busca departamentos e cargos do backend
 * e popula os selects do modal de cadastro.
 */
async function carregarOpcoes() {
    try {
        const response = await fetch('/api/opcoes');
        const data = await response.json();

        const depSelect = document.getElementById('departamento');
        const cargoSelect = document.getElementById('cargo');

        if (depSelect && cargoSelect) {
            depSelect.innerHTML = data.departamentos
                .map(dep => `<option value="${dep}">${dep}</option>`)
                .join('');

            cargoSelect.innerHTML = data.cargos
                .map(cargo => `<option value="${cargo}">${cargo}</option>`)
                .join('');
        }
    } catch (error) {
        console.error('Erro ao carregar opções:', error);
        showToast('Erro ao carregar departamentos e cargos', true);
    }
}


/**
 * Busca usuários do backend e renderiza na tabela
 * (utilizado na tela de administração).
 */
async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('tabela-usuarios');
    if (!tbody) return;

    try {
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();

        tbody.innerHTML = usuarios.map(user => `
            <tr>
                <td>
                    <strong>${user.nome}</strong><br>
                    <small class="text-muted">${user.email}</small>
                </td>
                <td>${user.departamento}</td>
                <td>${user.cargo}</td>
                <td>
                    <span class="badge bg-light text-success fw-bold">
                        ● ${user.status || 'Ativo'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-light">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-light text-danger">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}


/**
 * ==========================================================
 * FORMULÁRIO DE CADASTRO DE USUÁRIO
 * ==========================================================
 * Intercepta o submit e envia os dados via fetch (AJAX).
 */
function initUserForm() {
    const form = document.getElementById('formAddUser');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const dados = {
            nome: nome.value,
            email: email.value,
            matricula: matricula.value,
            departamento: departamento.value,
            cargo: cargo.value,
            nivel_acesso: nivel_acesso.value,
            senha: senha.value
        };

        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            if (!response.ok) throw new Error();

            showToast('Usuário cadastrado com sucesso!');
            setTimeout(() => location.reload(), 1200);
        } catch {
            showToast('Erro ao cadastrar usuário', true);
        }
    });
}


/**
 * ==========================================================
 * SISTEMA DE PONTO (ENTRADA / SAÍDA)
 * ==========================================================
 * Controla o fluxo de jornada do usuário.
 */
function toggleWork() {
    const now = new Date();

    // REGISTRO DE ENTRADA
    if (!state.working) {
        state.working = true;
        state.startTime = now;

        state.logs.unshift({
            event: 'Entrada',
            time: now.toLocaleTimeString('pt-BR'),
            status: 'Sucesso'
        });

        showToast('Entrada registrada com sucesso!');
    }

    // REGISTRO DE SAÍDA
    else if (state.working) {
        state.working = false;

        state.logs.unshift({
            event: 'Saída',
            time: now.toLocaleTimeString('pt-BR'),
            status: 'Sucesso'
        });

        showToast('Saída registrada com sucesso!');
    }

    // FALLBACK DE ERRO (defensivo)
    else {
        showToast('Erro ao registrar ponto', true);
        return;
    }

    syncButtonUI(); // Atualiza botão
    renderTable();  // Atualiza tabela
}


/**
 * ==========================================================
 * UI / INTERFACE
 * ==========================================================
 */

/**
 * Atualiza o estado visual do botão de ponto
 * conforme o usuário está trabalhando ou não.
 */
function syncButtonUI() {
    const btn = document.getElementById('btn-ponto');
    if (!btn) return;

    if (state.working) {
        btn.innerHTML = '<i class="bi bi-stop-fill me-2"></i>Registrar Saída';
    } else {
        btn.innerHTML = '<i class="bi bi-play-fill me-2"></i>Registrar Entrada';
    }
}


/**
 * Renderiza o histórico de registros de ponto
 * na tabela da dashboard.
 */
function renderTable() {
    const tableBody = document.getElementById('log-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = state.logs.map(log => `
        <tr>
            <td>${log.event}</td>
            <td>${log.time}</td>
            <td>
                <span class="badge bg-light text-success fw-bold">
                    ● ${log.status}
                </span>
            </td>
        </tr>
    `).join('');
}


/**
 * ==========================================================
 * RELÓGIO EM TEMPO REAL
 * ==========================================================
 */
function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clock = document.getElementById('realtime-clock');
    const date = document.getElementById('realtime-date');
    if (!clock || !date) return;

    const now = new Date();
    clock.innerText = now.toLocaleTimeString('pt-BR');
    date.innerText = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}


/**
 * ==========================================================
 * UTILIDADES
 * ==========================================================
 */

/**
 * Exibe mensagens toast (feedback ao usuário)
 * @param {string} message
 * @param {boolean} isError
 */
function showToast(message, isError = false) {
    const toastMsg = document.getElementById('toast-message');
    const toastEl = document.getElementById('liveToast');

    if (!toastMsg || !toastEl) return;

    toastMsg.innerText = message;
    toastEl.classList.toggle('bg-danger', isError);
    toastEl.classList.toggle('bg-dark', !isError);

    new bootstrap.Toast(toastEl).show();
}


/**
 * ==========================================================
 * SIDEBAR
 * ==========================================================
 * Marca automaticamente o item ativo
 * conforme a rota atual.
 */
function initSidebarActive() {
    const links = document.querySelectorAll('.sidebar .nav-link');
    const path = window.location.pathname;

    links.forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
}
