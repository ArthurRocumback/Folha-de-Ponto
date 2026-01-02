/**
 * =========================================
 * INTEGRAÇÃO COM O BANCO DE DADOS (API)
 * =========================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa funções de interface
    updateClock();
    setInterval(updateClock, 1000);
    
    // Carrega dados do Banco
    carregarOpcoes();
    carregarTabelaUsuarios();

    // Sincroniza UI do Ponto
    syncButtonUI();
    renderTable();

    if (state.working) {
        setInterval(updateLiveDuration, 60000);
        updateLiveDuration();
    }
});

// 1. Busca Departamentos e Cargos para o Modal
async function carregarOpcoes() {
    try {
        const response = await fetch('/api/opcoes');
        const data = await response.json();

        const depSelect = document.getElementById('departamento');
        const cargoSelect = document.getElementById('cargo');

        if (depSelect && cargoSelect) {
            depSelect.innerHTML = data.departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
            cargoSelect.innerHTML = data.cargos.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    } catch (error) {
        console.error("Erro ao carregar opções:", error);
    }
}

// 2. Busca e Renderiza os usuários na tabela principal
async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('tabela-usuarios');
    if (!tbody) return;

    try {
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();
        
        tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-light d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                            <i class="bi bi-person text-secondary"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${u.nome}</div>
                            <div class="small text-muted">${u.email}</div>
                        </div>
                    </div>
                </td>
                <td>${u.departamento}</td>
                <td>${u.cargo}</td>
                <td><span class="badge bg-light text-success fw-bold">● ${u.status || 'Ativo'}</span></td>
                <td>
                    <button class="btn btn-sm btn-light border-0"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-light border-0 text-danger"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Erro ao carregar tabela:", error);
    }
}

// 3. Envio do formulário de Novo Usuário
const formUser = document.getElementById('formAddUser');
if (formUser) {
    formUser.addEventListener('submit', async (e) => {
        e.preventDefault();

        const dados = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            matricula: document.getElementById('matricula').value,
            departamento: document.getElementById('departamento').value,
            cargo: document.getElementById('cargo').value,
            nivel_acesso: document.getElementById('nivel_acesso').value,
            senha: document.getElementById('senha').value
        };

        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                showToast("Usuário cadastrado com sucesso!");
                setTimeout(() => location.reload(), 1500);
            } else {
                const err = await response.json();
                alert("Erro: " + err.erro);
            }
        } catch (error) {
            alert("Erro na conexão com o servidor.");
        }
    });
}

/**
 * =========================================
 * RELÓGIO E SISTEMA DE PONTO (MANTIDOS)
 * =========================================
 */

function updateClock() {
    const clock = document.getElementById('realtime-clock');
    const date = document.getElementById('realtime-date');
    if (!clock || !date) return;

    const now = new Date();
    clock.innerText = now.toLocaleTimeString('pt-BR');
    date.innerText = now.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

const state = {
    working: false,
    startTime: null,
    logs: []
};

function toggleWork() {
    const now = new Date();
    state.working = !state.working;
    
    if (state.working) {
        state.startTime = now;
        state.logs.unshift({ event: "Entrada", time: now.toLocaleTimeString('pt-BR'), status: "Sucesso" });
        showToast("Ponto de entrada registrado!");
    } else {
        state.logs.unshift({ event: "Saída", time: now.toLocaleTimeString('pt-BR'), status: "Finalizado" });
        showToast("Ponto de saída registrado!");
    }
    
    syncButtonUI();
    renderTable();
}

function syncButtonUI() {
    const btn = document.getElementById('btn-ponto');
    const statusText = document.getElementById('work-status');
    const indicator = document.getElementById('status-indicator');
    if (!btn) return;

    if (state.working) {
        btn.innerHTML = '<i class="bi bi-stop-fill me-2"></i>Registrar Saída';
        btn.classList.replace('btn-brand', 'btn-dark');
        if(statusText) statusText.innerText = "Em atividade";
        if(indicator) indicator.classList.replace('bg-secondary', 'bg-success');
    } else {
        btn.innerHTML = '<i class="bi bi-play-fill me-2"></i>Registrar Entrada';
        btn.classList.replace('btn-dark', 'btn-brand');
        if(statusText) statusText.innerText = "Ponto não batido";
        if(indicator) indicator.classList.replace('bg-success', 'bg-secondary');
    }
}

function renderTable() {
    const tableBody = document.getElementById('log-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = state.logs.map(log => `
        <tr>
            <td class="fw-600">${log.event}</td>
            <td class="text-muted fw-bold">${log.time}</td>
            <td><span class="badge bg-light text-secondary fw-bold">● ${log.status}</span></td>
        </tr>
    `).join('');
}

function updateLiveDuration() {
    const hoursCard = document.getElementById('hours-today');
    if (!state.working || !state.startTime || !hoursCard) return;

    const diffMs = new Date() - new Date(state.startTime);
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    hoursCard.innerText = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
}

function showToast(message) {
    const toastMsg = document.getElementById('toast-message');
    const toastEl = document.getElementById('liveToast');
    if (toastMsg && toastEl) {
        toastMsg.innerText = message;
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}