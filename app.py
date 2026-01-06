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
    """
    Registra CREATE / UPDATE / DELETE de usuários.
    Usa o nome do usuário afetado (não ID).
    Blindado para não quebrar a ação principal.
    """
    try:
        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO auditoria_usuarios
            (acao, usuario_afetado, executado_por)
            VALUES (?, ?, ?)
            ''',
            (
                acao,
                usuario_afetado_nome,
                session.get('user_nome')
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
    """Logout e limpeza da sessão"""
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
    """Autentica usuário por matrícula ou email"""
    dados = request.json
    username = dados.get('username')
    password = dados.get('password')

    conn = get_db_connection()
    user = conn.execute(
        '''
        SELECT * FROM usuarios
        WHERE (matricula = ? OR email = ?) AND senha = ?
        ''',
        (username, username, password)
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "message": "Usuário ou senha inválidos"}), 401

    session.permanent = True
    session['user_id'] = user['id']
    session['user_nome'] = user['nome']
    session['user_nivel'] = user['nivel_acesso']

    return jsonify({"success": True, "redirect": url_for('dashboard')})


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
    """
    Retorna os registros de auditoria
    para exibição na tela administrativa.
    """
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    conn = get_db_connection()
    logs = conn.execute(
        '''
        SELECT
            acao,
            usuario_afetado,
            executado_por,
            data
        FROM auditoria_usuarios
        ORDER BY data DESC
        '''
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

    localizacao = dados.get('localizacao') or {}

    latitude = localizacao.get('latitude')
    longitude = localizacao.get('longitude')

    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    user_agent = request.headers.get('User-Agent')

    conn = get_db_connection()
    conn.execute(
        '''
        INSERT INTO registros_ponto
        (usuario_id, tipo, latitude, longitude, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
        ''',
        (
            session['user_id'],
            tipo,
            latitude,
            longitude,
            ip,
            user_agent
        )
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})

@app.route('/api/ponto', methods=['GET'])
def listar_pontos():
    """Lista últimos registros de ponto"""
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
    """Histórico completo de ponto"""
    conn = get_db_connection()
    registros = conn.execute(
        '''
        SELECT DATE(horario) as data,
               TIME(horario) as horario,
               tipo,
               localizacao
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in registros])


# ======================================================
# USUÁRIOS (ADMIN) + AUDITORIA
# ======================================================
@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    """Lista usuários (admin)"""
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

    if not dados.get('senha'):
        return jsonify({"error": "Senha é obrigatória"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''
        INSERT INTO usuarios
        (nome, email, departamento, cargo, nivel_acesso, senha, matricula, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            dados['nome'],
            dados['email'],
            dados['departamento'],
            dados['cargo'],
            dados['nivel_acesso'],
            dados['senha'],
            dados['matricula'],
            dados.get('status', 'Ativo')
        )
    )

    conn.commit()
    conn.close()

    registrar_auditoria('CREATE', dados['nome'])
    return jsonify({"success": True})


@app.route('/api/usuarios/<int:user_id>', methods=['PUT'])
def atualizar_usuario(user_id):
    """Edita usuário + auditoria"""
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    dados = request.json
    conn = get_db_connection()

    usuario = conn.execute(
        'SELECT nome FROM usuarios WHERE id = ?',
        (user_id,)
    ).fetchone()

    campos = [
        dados['nome'],
        dados['email'],
        dados['departamento'],
        dados['cargo'],
        dados['nivel_acesso'],
        dados['matricula'],
        dados.get('status', 'Ativo')
    ]

    sql = '''
        UPDATE usuarios
        SET nome = ?, email = ?, departamento = ?, cargo = ?,
            nivel_acesso = ?, matricula = ?, status = ?
    '''

    if 'senha' in dados:
        sql += ', senha = ?'
        campos.append(dados['senha'])

    sql += ' WHERE id = ?'
    campos.append(user_id)

    conn.execute(sql, campos)
    conn.commit()
    conn.close()

    if usuario:
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


# ======================================================
# OPÇÕES PARA SELECTS (DEPARTAMENTOS / CARGOS)
# ======================================================
@app.route('/api/opcoes', methods=['GET'])
def get_opcoes():
    """Retorna departamentos e cargos"""
    conn = get_db_connection()
    deps = conn.execute('SELECT nome FROM departamentos').fetchall()
    cargos = conn.execute('SELECT nome FROM cargos').fetchall()
    conn.close()

    return jsonify({
        "departamentos": [d['nome'] for d in deps],
        "cargos": [c['nome'] for c in cargos]
    })


# ======================================================
# START DA APLICAÇÃO
# ======================================================
if __name__ == '__main__':
    app.run(debug=True)
