

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);

    // Simulação de localização (apenas visual)
    setTimeout(() => {
        const loc = document.getElementById('location-text');
        if (loc) loc.innerText = "São Paulo, SP - Matriz";
    }, 1500);

    // Sincroniza o estado visual do botão
    syncButtonUI();
    renderTable();

    // Atualiza o contador de horas APENAS
    // enquanto o usuário estiver "trabalhando"
    if (state.working) {
        setInterval(updateLiveDuration, 60000);
        updateLiveDuration();
    }
});

/**
 * =========================================
 * RELÓGIO EM TEMPO REAL
 * =========================================
 */
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

/* =========================================
 * REGISTRO DE PONTO (ENTRADA / SAÍDA)
 * =========================================
 */
function handlePonto() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Alterna estado
    state.working = !state.working;
    const type = state.working ? 'Entrada' : 'Saída';

    if (state.working) {
        state.startTime = now.toISOString();

    } else {
        state.startTime = null;
    }

    // Adiciona registro na memória
    state.logs.unshift({
        type: type,
        time: timeStr,
        status: "Registro manual"
    });

    syncButtonUI();
    renderTable();
    showToast(`${type} registrada com sucesso às ${timeStr}`);
}

/**
 * =========================================
 * BOTÃO (ENTRADA / SAÍDA)
 * =========================================
 */
function syncButtonUI() {
    const btn = document.getElementById('btn-registrar');
    const btnText = document.getElementById('btn-text');
    if (!btn || !btnText) return;

    if (state.working) {
        btn.classList.add('saida');
        btnText.innerHTML = `REGISTRAR<br>SAÍDA`;
    } else {
        btn.classList.remove('saida');
        btnText.innerHTML = `REGISTRAR<br>ENTRADA`;
    }
}

/**
 * =========================================
 * TABELA DE ÚLTIMOS REGISTROS
 * =========================================
 */
function renderTable() {
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (state.logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-4 text-muted small">
                    Nenhum registro nesta sessão.
                </td>
            </tr>
        `;
        return;
    }

    state.logs.slice(0, 5).forEach(log => {
        const dotColor = log.type === 'Entrada'
            ? 'text-primary'
            : 'text-danger';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #f8f8f8">
                <td class="fw-600">
                    <i class="bi bi-circle-fill ${dotColor} me-2" style="font-size: 0.5rem"></i>
                    ${log.type}
                </td>
                <td class="text-muted fw-bold">${log.time}</td>
                <td>
                    <span class="badge bg-light text-secondary fw-bold" style="font-size: 0.65rem">
                        ● ${log.status}
                    </span>
                </td>
            </tr>
        `;
    });
}

/**
 * =========================================
 * CONTADOR DE HORAS EM TEMPO REAL
 * =========================================
 */
function updateLiveDuration() {
    const hoursCard = document.getElementById('hours-today');
    if (!state.working || !state.startTime || !hoursCard) return;

    const start = new Date(state.startTime);
    const now = new Date();
    const diffMs = now - start;

    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    hoursCard.innerText =
        `${diffHrs.toString().padStart(2, '0')}h ` +
        `${diffMins.toString().padStart(2, '0')}m`;
}

/**
 * =========================================
 * TOAST (FEEDBACK VISUAL)
 * =========================================
 */
function showToast(message) {
    const toastMsg = document.getElementById('toast-message');
    const toastEl = document.getElementById('liveToast');
    if (!toastMsg || !toastEl) return;

    toastMsg.innerText = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

const state = {
    working: false,
    startTime: null,
    logs: []
};