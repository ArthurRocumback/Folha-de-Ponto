from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import sqlite3
import os
from datetime import timedelta

# ======================================================
# CONFIGURAÇÃO INICIAL DA APLICAÇÃO
# ======================================================
app = Flask(__name__, template_folder='templates', static_folder='static')

# Chave de sessão (em produção, use variável de ambiente)
app.secret_key = 'chave_super_secreta'
app.permanent_session_lifetime = timedelta(hours=24)

# Caminho absoluto do banco SQLite
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'db_teste.sqlite')


# ======================================================
# CONEXÃO COM O BANCO DE DADOS
# ======================================================
def get_db_connection():
    """
    Cria e retorna uma conexão com o SQLite.
    row_factory permite acessar colunas por nome.
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# ======================================================
# MIDDLEWARE DE SEGURANÇA
# ======================================================
@app.before_request
def check_session():
    """
    Middleware de autenticação:
    - Libera login e arquivos estáticos
    - APIs retornam JSON 401
    - Páginas HTML redirecionam para /login
    """

    # Rotas públicas
    rotas_livres = [
        '/login',
        '/api/login'
    ]

    # Arquivos estáticos
    if request.path.startswith('/static/'):
        return

    # Libera rotas públicas
    if request.path in rotas_livres:
        return

    # APIs sem sessão → JSON
    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({"error": "Não autorizado"}), 401

    # Páginas sem sessão → redirect
    if 'user_id' not in session:
        return redirect(url_for('login'))

@app.after_request
def add_header(response):

    response.headers['Cache-Control'] = 'no-store'
    return response

# ======================================================
# FUNÇÃO DE AUDITORIA (REGISTRA AÇÕES EM USUÁRIOS)
# ======================================================
def registrar_auditoria(acao, usuario_afetado_nome):
    try:
        executado_por = session.get('user_nome') or 'Sistema'

        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO auditoria_usuarios
            (acao, usuario_afetado_id, usuario_afetado, executado_por)
            VALUES (?, ?, ?, ?)
            ''',
            (
                acao,
                None,
                usuario_afetado_nome,
                executado_por
            )
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print('Erro ao registrar auditoria:', e)


# ======================================================
# ROTAS DE TELAS (HTML)
# ======================================================
@app.route('/')
@app.route('/login')
def login():
    """Tela de login"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('Login.html')


@app.route('/dashboard')
def dashboard():
    """Dashboard principal"""
    return render_template('index.html')


@app.route('/perfil')
def perfil():
    """Perfil do usuário"""
    return render_template('perfil.html')


@app.route('/relatorios')
def relatorios():
    """Tela de relatórios"""
    return render_template('Relatorio.html')


@app.route('/usuarios')
def usuarios():
    """Gestão de usuários (somente administrador)"""
    if session.get('user_nivel') != 'Administrador':
        return redirect(url_for('dashboard'))
    return render_template('Usuarios.html')


@app.route('/api/logout')
def logout():
    # 🔴 NOVO: registra logout antes de limpar a sessão
    registrar_auditoria('LOGOUT', session.get('user_nome'))

    session.clear()
    return redirect(url_for('login'))


@app.route('/auditoria')
def auditoria():
    """
    Tela de auditoria do sistema.
    Apenas administradores podem acessar.
    """
    if session.get('user_nivel') != 'Administrador':
        return redirect(url_for('dashboard'))

    return render_template('Auditoria.html')



# ======================================================
# AUTENTICAÇÃO
# ======================================================
@app.route('/api/login', methods=['POST'])
def api_login():
    dados = request.json
    username = dados.get('username')
    password = dados.get('password')

    conn = get_db_connection()
    user = conn.execute(
        '''
        SELECT *
        FROM usuarios
        WHERE (matricula = ? OR email = ?)
          AND senha = ?
        ''',
        (username, username, password)
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({
            "success": False,
            "message": "Usuário ou senha inválidos"
        }), 401

    # ============================
    # CRIAÇÃO DA SESSÃO
    # ============================
    session.permanent = True
    session['user_id'] = user['id']
    session['user_nome'] = user['nome']
    session['user_nivel'] = user['nivel_acesso']
    session['user_cargo'] = user['cargo']   # 🔴 importante para regras futuras

    # Auditoria de login
    registrar_auditoria('LOGIN', user['nome'])

    # ============================
    # DEFINIÇÃO DO DESTINO (RBAC)
    # ============================

    # Padrão: dashboard comum (usuário ou estagiário)
    redirect_url = url_for('dashboard')

    # Se NÃO for administrador e NÃO for estagiário → é gestor
    if (
        user['nivel_acesso'] != 'Administrador'
        and user['cargo']
        and 'estagiário' not in user['cargo'].lower()
    ):
        redirect_url = url_for('dashboard_gestor')

    return jsonify({"success": True,"redirect": redirect_url})


# ======================================================
# PERFIL DO USUÁRIO (API)
# ======================================================
@app.route('/api/perfil', methods=['GET'])
def get_perfil():
    """Retorna dados do usuário logado"""
    conn = get_db_connection()
    user = conn.execute(
        'SELECT * FROM usuarios WHERE id = ?',
        (session['user_id'],)
    ).fetchone()
    conn.close()

    return jsonify(dict(user))

# ======================================================
# LISTAR AUDITORIA (API)
# ======================================================
@app.route('/api/auditoria', methods=['GET'])
def listar_auditoria():
    user_nome = session.get('user_nome')
    user_nivel = session.get('user_nivel')

    conn = get_db_connection()

    # 🔴 ADMINISTRADOR → vê tudo
    if user_nivel == 'Administrador':
        logs = conn.execute(
            '''
            SELECT
                a.acao,
                a.usuario_afetado,
                a.executado_por,
                a.data
            FROM auditoria_usuarios a
            ORDER BY a.data DESC
            '''
        ).fetchall()

        conn.close()
        return jsonify([dict(l) for l in logs])

    # 🟡 GESTOR → vê apenas estagiários vinculados a ele
    logs = conn.execute(
        '''
        SELECT
            a.acao,
            a.usuario_afetado,
            a.executado_por,
            a.data
        FROM auditoria_usuarios a
        JOIN usuarios u
            ON u.nome = a.usuario_afetado
        WHERE
            u.gestor = ?
            AND LOWER(u.cargo) LIKE '%estagiário%'
        ORDER BY a.data DESC
        ''',
        (user_nome,)
    ).fetchall()

    conn.close()
    return jsonify([dict(l) for l in logs])



# ======================================================
# PONTO ELETRÔNICO
# ======================================================
@app.route('/api/ponto', methods=['POST'])
def registrar_ponto():
    dados = request.json
    tipo = dados.get('tipo')

    if not tipo:
        return jsonify({"error": "Tipo inválido"}), 400

    conn = get_db_connection()

    # 🔒 Verifica se o usuário está ATIVO
    user = conn.execute(
        'SELECT status FROM usuarios WHERE id = ?',
        (session['user_id'],)
    ).fetchone()

    if not user or user['status'] != 'Ativo':
        conn.close()
        return jsonify({"error": "Usuário não está ativo"}), 403

    # Insere o ponto
    conn.execute(
        '''
        INSERT INTO registros_ponto (usuario_id, tipo)
        VALUES (?, ?)
        ''',
        (session['user_id'], tipo)
    )
    conn.commit()
    conn.close()

    # 🔴 NOVO: auditoria do ponto
    # Ex: PONTO_ENTRADA ou PONTO_SAÍDA
    registrar_auditoria(f'PONTO_{tipo.upper()}', session.get('user_nome'))

    return jsonify({"success": True})


@app.route('/api/ponto', methods=['GET'])
def listar_pontos():
    conn = get_db_connection()
    registros = conn.execute(
        '''
        SELECT tipo, horario
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        LIMIT 5
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in registros])



@app.route('/api/ponto/historico', methods=['GET'])
def historico_ponto():
    conn = get_db_connection()
    registros = conn.execute(
        '''
        SELECT tipo, horario
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in registros])

@app.route('/api/ponto/ausencias', methods=['GET'])
def listar_ausencias():
    conn = get_db_connection()

    registros = conn.execute(
        '''
        SELECT DATE(horario) as dia
        FROM registros_ponto
        WHERE usuario_id = ?
        GROUP BY DATE(horario)
        ''',
        (session['user_id'],)
    ).fetchall()

    conn.close()

    dias_com_ponto = {r['dia'] for r in registros}

    return jsonify({
        "dias_com_ponto": list(dias_com_ponto)
    })

# ======================================================
# USUÁRIOS (ADMIN) + AUDITORIA
# ======================================================

def gestor_valido(nome_gestor):
    if not nome_gestor:
        return None

    conn = get_db_connection()
    gestor = conn.execute(
        '''
        SELECT cargo
        FROM usuarios
        WHERE nome = ?
        ''',
        (nome_gestor,)
    ).fetchone()
    conn.close()

    if not gestor or not gestor['cargo']:
        return None

    return 'estagiário' not in gestor['cargo'].lower()


@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    # Lista usuários (admin)
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    conn = get_db_connection()
    usuarios = conn.execute(
        'SELECT * FROM usuarios ORDER BY id DESC'
    ).fetchall()
    conn.close()

    return jsonify([dict(u) for u in usuarios])


@app.route('/api/usuarios', methods=['POST'])
def criar_usuario():
    """Cria novo usuário + auditoria"""
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    dados = request.json

    cargo = dados.get('cargo', '')
    gestor = dados.get('gestor')

    if 'estagiário' in cargo.lower() and not gestor:
        return jsonify({"error": "Estagiário deve ter um gestor"}), 400

    if not dados.get('senha'):
        return jsonify({"error": "Senha é obrigatória"}), 400
    
    gestor = dados.get('gestor')
    if gestor and not gestor_valido(gestor):
        return jsonify({"error": "Gestor inválido"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            '''
            INSERT INTO usuarios
            (nome, email, departamento, cargo, gestor, nivel_acesso, senha, matricula, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                dados['nome'],
                dados['email'],
                dados['departamento'],
                dados['cargo'],
                gestor,
                dados['nivel_acesso'],
                dados['senha'],
                dados['matricula'],
                dados.get('status', 'Ativo')
            )
        )
        conn.commit()

    except sqlite3.IntegrityError as e:
        conn.close()

        if 'usuarios.email' in str(e):
            return jsonify({"error": "E-mail já cadastrado"}), 400

        if 'usuarios.matricula' in str(e):
            return jsonify({"error": "Matrícula já cadastrada"}), 400

        return jsonify({"error": "Erro de integridade no banco"}), 400

    conn.commit()
    conn.close()

    registrar_auditoria('CREATE', dados['nome'])
    return jsonify({"success": True})


@app.route('/api/usuarios/<int:user_id>', methods=['PUT'])
def atualizar_usuario(user_id):
    # 🔒 Permissão
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    dados = request.json

    cargo = dados.get('cargo', '')
    gestor = dados.get('gestor')

    # 🔒 Regra: estagiário precisa de gestor
    if 'estagiário' in cargo.lower() and not gestor:
        return jsonify({"error": "Estagiário deve ter um gestor"}), 400

    # 🔒 Regra: gestor não pode ser estagiário
    if gestor and not gestor_valido(gestor):
        return jsonify({"error": "Gestor inválido"}), 400

    conn = get_db_connection()

    # 🔎 Usuário atual (para auditoria)
    usuario = conn.execute(
        'SELECT nome FROM usuarios WHERE id = ?',
        (user_id,)
    ).fetchone()

    if not usuario:
        conn.close()
        return jsonify({"error": "Usuário não encontrado"}), 404

    # 🔧 Campos base
    campos = [
        dados['nome'],
        dados['email'],
        dados['departamento'],
        dados['cargo'],
        gestor,
        dados['nivel_acesso'],
        dados['matricula'],
        dados.get('status', 'Ativo')
    ]

    sql = '''
        UPDATE usuarios
        SET nome = ?, 
            email = ?, 
            departamento = ?, 
            cargo = ?,
            gestor = ?, 
            nivel_acesso = ?, 
            matricula = ?, 
            status = ?
    '''

    # 🔑 Senha só atualiza se vier preenchida
    if 'senha' in dados and dados['senha']:
        sql += ', senha = ?'
        campos.append(dados['senha'])

    sql += ' WHERE id = ?'
    campos.append(user_id)

    try:
        conn.execute(sql, campos)
        conn.commit()

    except sqlite3.IntegrityError as e:
        conn.close()

        if 'usuarios.email' in str(e):
            return jsonify({"error": "E-mail já cadastrado"}), 400

        if 'usuarios.matricula' in str(e):
            return jsonify({"error": "Matrícula já cadastrada"}), 400

        return jsonify({"error": "Erro de integridade no banco"}), 400

    conn.close()

    # 📝 Auditoria
    registrar_auditoria('UPDATE', usuario['nome'])

    return jsonify({"success": True})
    

@app.route('/api/usuarios/<int:user_id>', methods=['DELETE'])
def excluir_usuario(user_id):
    """Exclui usuário + auditoria"""
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    conn = get_db_connection()

    usuario = conn.execute(
        'SELECT nome FROM usuarios WHERE id = ?',
        (user_id,)
    ).fetchone()

    conn.execute('DELETE FROM usuarios WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

    if usuario:
        registrar_auditoria('DELETE', usuario['nome'])

    return jsonify({"success": True})

@app.route('/dashboard-gestor')
def dashboard_gestor():
    cargo = session.get('user_cargo', '').lower()

    if 'estagiário' in cargo:
        return redirect(url_for('dashboard'))

    return render_template('dashboard_gestor.html')


@app.route('/api/gestor/estagiarios', methods=['GET'])
def gestor_estagiarios():
    nome_gestor = session.get('user_nome')

    conn = get_db_connection()
    estagiarios = conn.execute(
        '''
        SELECT id, nome, email, departamento, status
        FROM usuarios
        WHERE gestor = ?
          AND LOWER(cargo) LIKE '%estagiário%'
        ORDER BY nome
        ''',
        (nome_gestor,)
    ).fetchall()
    conn.close()

    return jsonify([dict(e) for e in estagiarios])

@app.route('/api/gestor/estagiarios/auditoria', methods=['GET'])
def gestor_auditoria_estagiarios():
    nome_gestor = session.get('user_nome')

    conn = get_db_connection()
    logs = conn.execute(
        '''
        SELECT
            a.acao,
            a.usuario_afetado,
            a.executado_por,
            a.data
        FROM auditoria_usuarios a
        JOIN usuarios u ON u.nome = a.usuario_afetado
        WHERE
            u.gestor = ?
            AND LOWER(u.cargo) LIKE '%estagiário%'
        ORDER BY a.data DESC
        '''
        ,
        (nome_gestor,)
    ).fetchall()

    conn.close()
    return jsonify([dict(l) for l in logs])

# ======================================================
# OPÇÕES PARA SELECTS (DEPARTAMENTOS / CARGOS)
# ======================================================
@app.route('/api/opcoes', methods=['GET'])
def get_opcoes():
    """Retorna departamentos e cargos"""
    conn = get_db_connection()
    deps = conn.execute('SELECT nome FROM departamentos').fetchall()
    cargos = conn.execute('SELECT nome FROM cargos').fetchall()
    gestores = conn.execute('''SELECT nome FROM usuarios WHERE cargo IS NOT NULL AND LOWER(cargo) NOT LIKE '%estagiário%' ORDER BY nome ''').fetchall()
    conn.close()

    return jsonify({
        "departamentos": [d['nome'] for d in deps],
        "cargos": [c['nome'] for c in cargos],
        "gestores": [g['nome'] for g in gestores]
    })


# ======================================================
# START DA APLICAÇÃO
# ======================================================
if __name__ == '__main__':
    app.run(debug=True)
