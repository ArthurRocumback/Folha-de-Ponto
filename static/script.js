/**
 * LÓGICA DE GESTÃO DE USUÁRIOS
 */

let usuarioEmEdicaoId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verifica se estamos na página de usuários antes de rodar a lógica
    const tableBody = document.getElementById('user-table-body');
    if (tableBody) {
        carregarOpcoes();
        carregarTabelaUsuarios();
        
        const form = document.getElementById('formAddUser');
        if (form) {
            form.addEventListener('submit', salvarUsuario);
        }
    }
    
    initClock();
    setInterval(initClock, 1000);
});

async function carregarOpcoes() {
    try {
        const response = await fetch('/api/opcoes');
        const data = await response.json();
        const depSelect = document.getElementById('departamento');
        const cargoSelect = document.getElementById('cargo');
        
        if (depSelect) depSelect.innerHTML = data.departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
        if (cargoSelect) cargoSelect.innerHTML = data.cargos.map(c => `<option value="${c}">${c}</option>`).join('');
    } catch (e) {
        console.error("Erro ao carregar opções", e);
    }
}

async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('user-table-body');
    if (!tbody) return;

    try {
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();

        tbody.innerHTML = usuarios.map(u => {
            const userJson = JSON.stringify(u).replace(/"/g, '&quot;');
            return `
                <tr>
                    <td class="fw-bold">${u.nome}</td>
                    <td class="text-muted">${u.email}</td>
                    <td><span class="badge bg-light text-dark">${u.departamento}</span></td>
                    <td class="fw-600">${u.matricula}</td>
                    <td><span class="badge bg-success-subtle text-success">● ${u.status || 'Ativo'}</span></td>
                    <td class="text-end">
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-sm btn-light border" onclick="prepararEdicao(${userJson})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-light border text-danger" onclick="excluirUsuario(${u.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Erro ao carregar tabela", e);
    }
}

async function salvarUsuario(e) {
    e.preventDefault();
    
    // Confirmação para edição
    if (usuarioEmEdicaoId && !confirm("Deseja salvar as alterações feitas neste usuário?")) {
        return;
    }

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
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (response.ok) {
            const modalEl = document.getElementById('addUserModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            e.target.reset();
            usuarioEmEdicaoId = null;
            carregarTabelaUsuarios();
        } else {
            const err = await response.json();
            alert("Erro: " + (err.error || "Falha ao salvar"));
        }
    } catch (e) {
        console.error("Erro na requisição", e);
    }
}

function prepararEdicao(usuario) {
    usuarioEmEdicaoId = usuario.id;
    
    document.getElementById('nome').value = usuario.nome;
    document.getElementById('email').value = usuario.email;
    document.getElementById('departamento').value = usuario.departamento;
    document.getElementById('cargo').value = usuario.cargo;
    document.getElementById('matricula').value = usuario.matricula;
    document.getElementById('nivel_acesso').value = usuario.nivel_acesso;
    
    // Na edição a senha não deve ser obrigatória
    const senhaInput = document.getElementById('senha');
    senhaInput.value = '';
    senhaInput.removeAttribute('required');
    senhaInput.placeholder = "Deixe em branco para manter a atual";
    
    const modalEl = document.getElementById('addUserModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Resetar quando fechar o modal
    modalEl.addEventListener('hidden.bs.modal', () => {
        usuarioEmEdicaoId = null;
        document.getElementById('formAddUser').reset();
        senhaInput.setAttribute('required', 'required');
        senhaInput.placeholder = "********";
    }, { once: true });
}

async function excluirUsuario(id) {
    // Campo de confirmação para excluir
    if (!confirm("Tem certeza que deseja EXCLUIR permanentemente este usuário? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        const response = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarTabelaUsuarios();
        } else {
            alert("Erro ao excluir usuário.");
        }
    } catch (e) {
        console.error("Erro ao excluir", e);
    }
}

function initClock() {
    const clock = document.getElementById('realtime-clock');
    const date = document.getElementById('realtime-date');
    if (!clock || !date) return;
    const now = new Date();
    clock.innerText = now.toLocaleTimeString('pt-BR');
    date.innerText = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}